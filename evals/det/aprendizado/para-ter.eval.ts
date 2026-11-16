import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import type { EntradaDoAcompanhante } from "@/core/agents/companion/entrada"
import { type DadosDoPreparo, preparar } from "@/core/agents/companion/preparo"
import { lerConteudo } from "@/core/proposals/conteudo"
import { propostaDoParaTer } from "@/core/proposals/montar"
import { getContainer } from "@/infra/container"
import {
  cenariosDeConversa,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Vale ter em casa: o item que faltou para a sugestão vira linha da lista; aprovada grava, recusada bloqueia o
// alimento nos runs seguintes, expirada não bloqueia.

const kb = getContainer().knowledge
const MINUTO = 60_000

function somenteAtalhos(): CenarioDeConversa {
  const c = cenariosDeConversa["so-atalhos"]
  if (!c) throw new Error("cenário so-atalhos ausente")
  return c
}

// O preparo da próxima mensagem do momento com frio, sem gravar nada.
async function preparoSeguinte(deps: DepsDoCenario, contaId: string): Promise<DadosDoPreparo> {
  const entrada: EntradaDoAcompanhante = {
    texto: "e agora, o que tomo?",
    intencoes: ["momento"],
    estados: ["com_frio"],
    evitar_da_mensagem: [],
  }
  return preparar(
    { stores: deps.stores, kb, clock: deps.clock, telemetry: deps.telemetry },
    contaId,
    entrada,
  )
}

const linhasDaLista = (deps: DepsDoCenario, contaId: string) => deps.stores.shortages.lista(contaId)

const propostasDeLista = async (deps: DepsDoCenario, contaId: string, runId: string) =>
  (await deps.stores.proposals.doRun(contaId, runId)).filter((p) => p.tool === "lista.propor")

const metricasParaTer = (deps: DepsDoCenario) =>
  deps.telemetry.metricas.filter((m) => m.nome === "ritu_para_ter_total")

const etapaDeParaTer = (deps: DepsDoCenario, etapa: string) =>
  metricasParaTer(deps)
    .filter((m) => m.rotulos.etapa === etapa)
    .map((m) => m.valor)

describe("para_ter na saída gera a linha da lista no bloco", () => {
  it("a linha do bloco é a que propostaDoParaTer faz da saída, com motivo fez_falta e as vezes", async () => {
    const c = somenteAtalhos()
    const { contaId, deps } = await montarCenario(c)
    const { final } = await rodarCenario(deps, contaId, c)
    const saida = final.saida

    expect(final.status).toBe("waiting_for_approval")
    expect(saida?.para_ter).toBeDefined()
    expect((saida?.propostas ?? []).some((p) => p.tool === "lista.propor")).toBe(true)
    const linhas = await propostasDeLista(deps, contaId, final.run_id)
    expect(linhas.map((p) => lerConteudo(p.tool, p.conteudo))).toEqual(
      propostaDoParaTer(saida ?? {}),
    )
    expect(propostaDoParaTer({ para_ter: { alimento_id: "tofu", vezes: 2 } })).toEqual([
      { tool: "lista.propor", alimento_id: "tofu", motivo: "fez_falta", detalhe: "2" },
    ])
    expect(propostaDoParaTer({})).toEqual([])
  })
})

describe("aprovada grava a lista e soma a etapa aprovada", () => {
  it("o item entra na lista com fez_falta e o número de vezes, e soma ritu_para_ter_total aprovada", async () => {
    const c = somenteAtalhos()
    const { contaId, deps } = await montarCenario(c)
    const { final } = await rodarCenario(deps, contaId, c, {
      decidir: async (propostas) =>
        propostas.filter((p) => p.tool === "lista.propor").map((p) => p.id),
    })
    const paraTer = final.saida?.para_ter
    const linha = (await linhasDaLista(deps, contaId)).find(
      (l) => l.alimento_id === paraTer?.alimento_id,
    )

    expect(linha).toMatchObject({
      alimento_id: paraTer?.alimento_id,
      motivo: "fez_falta",
      detalhe: String(paraTer?.vezes),
    })
    expect(etapaDeParaTer(deps, "aprovada")).toEqual([1])
    expect(etapaDeParaTer(deps, "recusada")).toEqual([])
  })
})

describe("recusada não grava e bloqueia o alimento nos runs seguintes", () => {
  it("a lista fica sem o item, soma recusada, e o próximo preparo não traz o alimento de novo", async () => {
    const c = somenteAtalhos()
    const { contaId, deps } = await montarCenario(c)
    const { final } = await rodarCenario(deps, contaId, c, { decidir: async () => [] })
    const alimento = final.saida?.para_ter?.alimento_id ?? ""

    expect(await linhasDaLista(deps, contaId)).toEqual([])
    expect(etapaDeParaTer(deps, "recusada")).toEqual([1])
    expect((await deps.stores.proposals.recusadas(contaId, "lista.propor")).length).toBe(1)

    const seguinte = await preparoSeguinte(deps, contaId)
    expect(seguinte.lista_recusada).toEqual([alimento])
    expect(seguinte.para_ter?.alimento_id).not.toBe(alimento)
  })
})

describe("expirada não bloqueia", () => {
  it("a aprovação passa do prazo: a linha vira expirada, e o alimento volta a poder ser proposto", async () => {
    const c = somenteAtalhos()
    const { contaId, deps } = await montarCenario(c)
    const { final } = await rodarCenario(deps, contaId, c)
    const alimento = final.saida?.para_ter?.alimento_id ?? ""
    const linhas = await propostasDeLista(deps, contaId, final.run_id)

    const agora = Date.parse(c.agora)
    deps.clock.set(new Date(agora + (config.memoria.esperaMinutos + 1) * MINUTO).toISOString())
    await expect(
      deps.conversation.aprovar(
        contaId,
        final.run_id,
        linhas.map((p) => p.id),
      ),
    ).rejects.toMatchObject({ code: "aprovacao_expirada" })

    const [linha] = await propostasDeLista(deps, contaId, final.run_id)
    expect(linha?.decisao).toBe("expirada")
    expect(await linhasDaLista(deps, contaId)).toEqual([])
    expect(etapaDeParaTer(deps, "recusada")).toEqual([])

    const seguinte = await preparoSeguinte(deps, contaId)
    expect(seguinte.lista_recusada).toEqual([])
    expect(seguinte.para_ter?.alimento_id).toBe(alimento)
  })
})
