import { describe, expect, it } from "vitest"
import type { EntradaDoAcompanhante } from "@/core/agents/companion/entrada"
import { preparar } from "@/core/agents/companion/preparo"
import { executarLimpeza } from "@/core/cleanup"
import { lerConteudo } from "@/core/proposals/conteudo"
import { RunNaoContinuavelError } from "@/core/runs/errors"
import { getContainer } from "@/infra/container"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import {
  cenariosComAprovacao,
  cenariosDeConversa,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Prazo da aprovação: 30 minutos exatos ainda valem; 31 expiram. Limpeza expira o run em espera antes do prazo.
const MINUTO = 60_000
const AGORA = "2026-06-15T22:00:00.000Z"
const kb = getContainer().knowledge

// Entrega sem sugestão: serve à segunda mensagem, sem repetir a refeição do dia; o incerto evita a violação "vazia".
const ENTREGA_SEM_SUGESTAO = {
  resposta: "Para agora, vale algo morno e simples. Se puder, sente-se para comer, sem tela.",
  explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
  sugestoes: [],
  evitar: [],
  incertos: ["Não sei o que há na sua casa."],
  citados: [],
}

function cenarioDeAprovacao(nome: string): CenarioDeConversa {
  const c = cenariosComAprovacao[nome] ?? cenariosDeConversa[nome]
  if (!c) throw new Error(`cenário de aprovação ausente: ${nome}`)
  return c
}

// Roda o cenário até o bloco abrir, sem decidir e sem a segunda mensagem.
async function abrirBloco(nome: string, extra: Partial<CenarioDeConversa> = {}) {
  const base = cenarioDeAprovacao(nome)
  const c: CenarioDeConversa = { ...base, aprovacao: undefined, depois: undefined, ...extra }
  const { contaId, deps } = await montarCenario(c)
  const rodada = await rodarCenario(deps, contaId, c)
  const runId = rodada.final.run_id
  const ids = rodada.final.saida?.propostas.map((p) => p.id) ?? []
  return { contaId, deps, rodada, runId, ids }
}

// Lista de faltas do bloco (proposta lista.propor), a única com o alimento que o eval confere.
async function linhaDeLista(deps: DepsDoCenario, contaId: string, runId: string) {
  const doRun = await deps.stores.proposals.doRun(contaId, runId)
  return doRun.find((p) => p.tool === "lista.propor")
}

describe("expiração: prazo de 30 minutos", () => {
  it("aos 30 minutos exatos a aprovação ainda vale", async () => {
    const { contaId, deps, runId, ids } = await abrirBloco("aprovacao-parcial")
    deps.clock.advance(30 * MINUTO)

    const r = await deps.conversation.aprovar(contaId, runId, ids.slice(0, 1))

    expect(r.status).toBe("done")
    expect(r.gravadas).toHaveLength(1)
  })

  it("aos 31 minutos a aprovação expira: aprovacao_expirada, run expired e propostas expiradas", async () => {
    const { contaId, deps, runId, ids } = await abrirBloco("aprovacao-parcial")
    deps.clock.advance(31 * MINUTO)

    await expect(deps.conversation.aprovar(contaId, runId, ids)).rejects.toMatchObject({
      code: "aprovacao_expirada",
    })

    expect((await deps.stores.runs.buscar(contaId, runId))?.status).toBe("expired")
    const doRun = await deps.stores.proposals.doRun(contaId, runId)
    expect(doRun.length).toBeGreaterThan(0)
    expect(doRun.every((p) => p.decisao === "expirada")).toBe(true)
  })

  it("expirada não entra em recusadas: a lista expirada não bloqueia o alimento", async () => {
    const { contaId, deps, runId } = await abrirBloco("faltou-hoje")
    expect((await linhaDeLista(deps, contaId, runId))?.decisao).toBe("pendente")

    deps.clock.advance(31 * MINUTO)
    await expect(deps.conversation.aprovar(contaId, runId, [])).rejects.toMatchObject({
      code: "aprovacao_expirada",
    })

    expect((await linhaDeLista(deps, contaId, runId))?.decisao).toBe("expirada")
    expect(await deps.stores.proposals.recusadas(contaId, "lista.propor")).toEqual([])
  })
})

describe("recusada: bloqueia a mesma lista num run seguinte", () => {
  // Segunda mensagem igual à primeira, com "Não tenho" para o gengibre e entrega sem sugestão (a refeição
  // da primeira já saiu hoje e o validador a recusaria como repetida).
  function comSegundaMensagem(
    base: CenarioDeConversa,
    decisao: CenarioDeConversa["aprovacao"],
  ): CenarioDeConversa {
    if (!base.interpretacao) throw new Error("cenário sem interpretação")
    return {
      ...base,
      aprovacao: decisao,
      depois: {
        mensagem: base.mensagem,
        interpretacao: base.interpretacao,
        roteiro: [
          ...base.roteiro.slice(0, 3),
          {
            texto: "Vou responder sem sugestão.",
            chamadas: [{ nome: "finalizar", argumentos: ENTREGA_SEM_SUGESTAO }],
          },
        ],
      },
    }
  }

  it("recusar a lista põe o gengibre em recusadas e a segunda mensagem não propõe a lista de novo", async () => {
    const base = cenarioDeAprovacao("faltou-hoje")
    const c = comSegundaMensagem(base, "agora_nao")
    const { contaId, deps } = await montarCenario(c)

    const rodada = await rodarCenario(deps, contaId, c)

    expect(rodada.bloco?.resultado.recusadas).toHaveLength(1)
    const recusadas = await deps.stores.proposals.recusadas(contaId, "lista.propor")
    expect(recusadas.map((p) => lerConteudo(p.tool, p.conteudo))).toEqual([
      expect.objectContaining({ tool: "lista.propor", alimento_id: "gengibre" }),
    ])
    const segunda = rodada.depois?.final
    expect(segunda?.status).toBe("done")
    expect(segunda?.saida?.propostas).toEqual([])
  })

  it("controle: sem recusa antes, a mesma segunda mensagem propõe a lista de novo", async () => {
    // O bloco fica aberto e a segunda mensagem o expira: a lista não foi recusada, então volta.
    const base = cenarioDeAprovacao("faltou-hoje")
    const c = comSegundaMensagem(base, undefined)
    const { contaId, deps } = await montarCenario(c)

    const rodada = await rodarCenario(deps, contaId, c)

    expect(rodada.depois?.final.status).toBe("waiting_for_approval")
    const propostas = rodada.depois?.final.saida?.propostas ?? []
    expect(propostas.map((p) => p.tool)).toContain("lista.propor")
  })

  it("'vale ter em casa' deixa de indicar o alimento recusado", async () => {
    const clock = createFixedClock(AGORA)
    const stores = createMemoryStores(clock, { alimentoExiste: (id) => Boolean(kb.alimento(id)) })
    const telemetry = createMemoryTelemetry()
    const conta = await stores.accounts.criar({ tipo: "demo" })
    // Gengibre faltou em três dias (o mínimo para indicar "vale ter em casa").
    for (const dia of ["2026-06-12", "2026-06-13", "2026-06-14"]) {
      await stores.shortages.registrar(
        conta.id,
        [{ alimento_id: "gengibre", origem: "nao_tenho" }],
        dia,
      )
    }
    const deps = { stores, kb, clock, telemetry }
    const entrada: EntradaDoAcompanhante = {
      intencoes: ["momento"],
      estados: ["com_frio"],
      evitar_da_mensagem: [],
    }

    expect((await preparar(deps, conta.id, entrada)).para_ter?.alimento_id).toBe("gengibre")

    // Lista de gengibre proposta num run e recusada na aprovação.
    const run = await stores.runs.criar(conta.id, {
      caminho: "acompanhante",
      intencoes: [],
      dia: "2026-06-15",
    })
    const [proposta] = await stores.proposals.criar(conta.id, run.id, [
      {
        tool: "lista.propor",
        conteudo: { alimento_id: "gengibre", motivo: "faltou_hoje", detalhe: "Chá de gengibre" },
      },
    ])
    await stores.proposals.decidir(conta.id, proposta?.id ?? "", "recusada")

    expect((await preparar(deps, conta.id, entrada)).para_ter?.alimento_id).not.toBe("gengibre")
  })
})

describe("limpeza: run aguardando a aprovação", () => {
  it("expirado pela limpeza, aprovar não continua o run", async () => {
    const { contaId, deps, runId, ids } = await abrirBloco("aprovacao-parcial")
    deps.clock.advance(31 * MINUTO)

    const limpeza = await executarLimpeza({
      stores: deps.stores,
      clock: deps.clock,
      ledger: deps.ledger,
    })

    expect(limpeza.runs_expirados).toBe(1)
    expect((await deps.stores.runs.buscar(contaId, runId))?.status).toBe("expired")
    await expect(deps.conversation.aprovar(contaId, runId, ids)).rejects.toBeInstanceOf(
      RunNaoContinuavelError,
    )
  })

  it("dentro do prazo, a limpeza não expira o run e a aprovação segue", async () => {
    const { contaId, deps, runId, ids } = await abrirBloco("aprovacao-parcial")
    deps.clock.advance(30 * MINUTO)

    const limpeza = await executarLimpeza({
      stores: deps.stores,
      clock: deps.clock,
      ledger: deps.ledger,
    })

    expect(limpeza.runs_expirados).toBe(0)
    const r = await deps.conversation.aprovar(contaId, runId, ids.slice(0, 1))
    expect(r.status).toBe("done")
  })
})
