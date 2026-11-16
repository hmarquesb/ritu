import { describe, expect, it } from "vitest"
import type { EntradaDoAcompanhante } from "@/core/agents/companion/entrada"
import { sinaisDe } from "@/core/agents/companion/filtro-da-pessoa"
import { type DadosDoPreparo, preparar } from "@/core/agents/companion/preparo"
import { RituError } from "@/core/errors"
import type { Preferencia } from "@/core/preferences/ports"
import { lerConteudo } from "@/core/proposals/conteudo"
import { getContainer } from "@/infra/container"
import {
  cenarios,
  cenariosDeAprendizado,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Gosto: o que a pessoa diz de um alimento vale no preparo seguinte; o gosto da mensagem vale no run e só grava com aprovação.
const kb = getContainer().knowledge
const MINUTO = 60_000

function frioAgitada() {
  const c = cenarios["frio-agitada"]
  if (!c) throw new Error("cenário frio-agitada ausente")
  return c
}

function cenarioDeGosto(nome: string): CenarioDeConversa {
  const c = cenariosDeAprendizado[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  return c
}

// O preparo que a próxima mensagem do momento frio-agitada teria, sem gravar nada.
async function preparoSeguinte(
  deps: DepsDoCenario,
  contaId: string,
  extra: Partial<EntradaDoAcompanhante> = {},
): Promise<DadosDoPreparo> {
  return preparar(
    { stores: deps.stores, kb, clock: deps.clock, telemetry: deps.telemetry },
    contaId,
    { ...frioAgitada().entrada, ...extra },
  )
}

// Ids dos alimentos de todos os candidatos do preparo (itens e opções).
function alimentosDoPreparo(dados: DadosDoPreparo): string[] {
  return dados.candidatos_do_preparo.flatMap((c) => c.alimentos)
}

// Só os itens com gosto marcado: a entrega também cria preferências (sem gosto) ao marcar o já sugerido.
const gostosGravados = (prefs: Preferencia[]) => prefs.filter((p) => p.gosto !== null)

// Ids das opções de uma vaga num candidato do preparo.
function opcoesDaVaga(dados: DadosDoPreparo, candidato: string, vaga: string): string[] {
  const c = dados.candidatos.find((x) => x.id === candidato)
  return (c?.opcoes?.[vaga as "tempero"] ?? []).map((o) => o.alimento_id)
}

describe("gosto dito pela pessoa (toque) vale no preparo seguinte", () => {
  it("nao_gosta tira o alimento de todos os candidatos do run seguinte", async () => {
    const { contaId, deps } = await montarCenario(frioAgitada())
    const antes = await preparoSeguinte(deps, contaId)
    expect(alimentosDoPreparo(antes)).toContain("gengibre")

    await deps.touches.tocarGosto(contaId, { tipo: "alimento", id: "gengibre" }, "nao_gosta")
    const depois = await preparoSeguinte(deps, contaId)

    expect(depois.filtro.nao_gosta).toContain("gengibre")
    expect(alimentosDoPreparo(depois)).not.toContain("gengibre")
  })

  it("gosta sobe o alimento na ordem das opções da sua vaga", async () => {
    const { contaId, deps } = await montarCenario(frioAgitada())
    const antes = await preparoSeguinte(deps, contaId)
    const ordem = opcoesDaVaga(antes, "pure-de-raiz", "tempero")
    const escolhido = ordem.at(-1)
    expect(escolhido).toBeDefined()

    await deps.touches.tocarGosto(contaId, { tipo: "alimento", id: escolhido ?? "" }, "gosta")
    const depois = await preparoSeguinte(deps, contaId)

    expect(opcoesDaVaga(depois, "pure-de-raiz", "tempero").indexOf(escolhido ?? "")).toBeLessThan(
      ordem.indexOf(escolhido ?? ""),
    )
    expect(depois.sinais.registros_de_gosto).toBe(1)
  })

  it("limpar o gosto volta ao preparo de antes, e a métrica soma 'limpou'", async () => {
    const { contaId, deps } = await montarCenario(frioAgitada())
    const antes = await preparoSeguinte(deps, contaId)

    await deps.touches.tocarGosto(contaId, { tipo: "alimento", id: "gengibre" }, "nao_gosta")
    await deps.touches.tocarGosto(contaId, { tipo: "alimento", id: "gengibre" }, null)
    const limpo = await preparoSeguinte(deps, contaId)

    expect(limpo.filtro.nao_gosta).toEqual(antes.filtro.nao_gosta)
    expect(alimentosDoPreparo(limpo)).toEqual(alimentosDoPreparo(antes))
    const limpou = deps.telemetry.metricas.filter(
      (m) => m.nome === "ritu_gosto_total" && m.rotulos.gosto === "limpou",
    )
    expect(limpou).toHaveLength(1)
  })

  it("toque em item que não está na base: toque_invalido, e nada muda", async () => {
    const { contaId, deps } = await montarCenario(frioAgitada())

    await expect(
      deps.touches.tocarGosto(contaId, { tipo: "alimento", id: "nao-existe" }, "gosta"),
    ).rejects.toBeInstanceOf(RituError)
    expect(await deps.stores.preferences.ler(contaId)).toEqual([])
  })
})

describe("gosto escrito na mensagem: vale no run, grava só com aprovação", () => {
  it("o gosto da mensagem muda a ordem das opções no preparo do próprio run", async () => {
    const { contaId, deps } = await montarCenario(frioAgitada())
    const sem = await preparoSeguinte(deps, contaId)
    const ordem = opcoesDaVaga(sem, "pure-de-raiz", "tempero")
    const citado = ordem.at(-1) ?? ""

    const com = await preparoSeguinte(deps, contaId, { gosta_da_mensagem: [citado] })
    const nomeCitado = kb.alimento(citado)?.nome

    expect(com.gosta_da_mensagem).toEqual([nomeCitado])
    expect(opcoesDaVaga(com, "pure-de-raiz", "tempero").indexOf(citado)).toBeLessThan(
      ordem.indexOf(citado),
    )
  })

  it("o gosto da mensagem não entra nos sinais da pessoa: só o banco conta", async () => {
    const c = { ...cenarioDeGosto("gosto-escrito"), aprovacao: undefined }
    const { contaId, deps } = await montarCenario(c)
    await rodarCenario(deps, contaId, c)

    expect(sinaisDe(await deps.stores.preferences.ler(contaId), []).gosta).toEqual([])
    const dados = await preparoSeguinte(deps, contaId, { gosta_da_mensagem: ["gengibre"] })
    expect(dados.sinais.registros_de_gosto).toBe(0)
  })

  it("sem decisão do bloco: a linha 'Você gosta de' fica pendente e nada é gravado", async () => {
    const c = cenarioDeGosto("gosto-escrito")
    const { contaId, deps } = await montarCenario({ ...c, aprovacao: undefined })
    const rodada = await rodarCenario(deps, contaId, { ...c, aprovacao: undefined })
    const linhas = await deps.stores.proposals.doRun(contaId, rodada.final.run_id)
    const gosta = linhas.find((p) => lerConteudo(p.tool, p.conteudo)?.tool === "memoria.propor")

    expect(gosta?.decisao).toBe("pendente")
    expect(gostosGravados(await deps.stores.preferences.ler(contaId))).toEqual([])
  })

  it("recusada no bloco: nada é gravado e a linha fica recusada", async () => {
    const c = cenarioDeGosto("gosto-escrito")
    const { contaId, deps } = await montarCenario({ ...c, aprovacao: "agora_nao" })
    const rodada = await rodarCenario(deps, contaId, { ...c, aprovacao: "agora_nao" })
    const linhas = await deps.stores.proposals.doRun(contaId, rodada.final.run_id)

    expect(linhas.length).toBeGreaterThan(0)
    expect(linhas.every((p) => p.decisao === "recusada")).toBe(true)
    expect(gostosGravados(await deps.stores.preferences.ler(contaId))).toEqual([])
  })

  it("expirada: aprovar depois do prazo não grava e a linha fica expirada", async () => {
    const c = cenarioDeGosto("gosto-escrito")
    const { contaId, deps } = await montarCenario({ ...c, aprovacao: undefined })
    const rodada = await rodarCenario(deps, contaId, { ...c, aprovacao: undefined })
    const runId = rodada.final.run_id
    const ids = (await deps.stores.proposals.doRun(contaId, runId)).map((p) => p.id)
    deps.clock.advance(31 * MINUTO)

    await expect(deps.conversation.aprovar(contaId, runId, ids)).rejects.toMatchObject({
      code: "aprovacao_expirada",
    })
    expect(gostosGravados(await deps.stores.preferences.ler(contaId))).toEqual([])
    const linhas = await deps.stores.proposals.doRun(contaId, runId)
    expect(linhas.every((p) => p.decisao === "expirada")).toBe(true)
  })

  it("aprovada: o gosto é gravado e soma ritu_gosto_total com gosta", async () => {
    const c = cenarioDeGosto("gosto-escrito")
    const { contaId, deps } = await montarCenario(c)
    await rodarCenario(deps, contaId, c)

    const prefs = await deps.stores.preferences.ler(contaId, [{ tipo: "alimento", id: "gengibre" }])
    expect(prefs[0]?.gosto).toBe("gosta")
    const gostos = deps.telemetry.metricas
      .filter((m) => m.nome === "ritu_gosto_total" && m.rotulos.gosto === "gosta")
      .reduce((soma, m) => soma + m.valor, 0)
    expect(gostos).toBe(1)
  })
})
