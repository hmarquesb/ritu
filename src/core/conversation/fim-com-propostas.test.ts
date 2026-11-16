import { describe, expect, it, vi } from "vitest"
import { saidaDeCodigo } from "@/core/agents/companion/saida"
import type { Anotacao } from "@/core/proposals/anotacao"
import { createRunService } from "@/core/runs/run-service"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { fecharComPropostas, fecharOuFalhar } from "./fim-com-propostas"

const kb = createMiniKnowledge()
const SEGREDO = "alimento-secreto-da-pessoa"

async function montar() {
  const clock = createFixedClock("2026-11-15T18:00:00.000Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const runs = createRunService({
    stores,
    tx: stores,
    runtime: createScriptedRuntime([], clock),
    clock,
    telemetry,
  })
  const conta = await stores.accounts.criar({ tipo: "demo" })
  const run = await runs.iniciarRun(conta.id, { caminho: "acompanhante", intencoes: [] })
  const deps = { stores, kb, runs, telemetry }
  return { stores, telemetry, runs, conta, run, deps }
}

type M = Awaited<ReturnType<typeof montar>>

const casaTem: Anotacao = { tipo: "casa_tem", itens: [{ nome: SEGREDO }] }
const rotina = (texto: string) => ({
  tool: "memoria.propor" as const,
  tipo: "rotina" as const,
  texto,
})

function pedido(m: M, extra: Partial<Parameters<typeof fecharComPropostas>[1]> = {}) {
  const anotacoes = extra.anotacoes ?? [casaTem]
  return {
    contaId: m.conta.id,
    runId: m.run.id,
    caminho: "acompanhante" as const,
    comIncomodo: false,
    saida: saidaDeCodigo("Anotei o que você contou.", anotacoes),
    anotacoes,
    ...extra,
  }
}

describe("fecharComPropostas", () => {
  it("sem nada a propor encerra em done com propostas vazias", async () => {
    const m = await montar()
    const final = await fecharComPropostas(m.deps, pedido(m, { anotacoes: [] }))
    expect(final.propostas).toEqual([])
    const run = await m.stores.runs.buscar(m.conta.id, m.run.id)
    expect(run?.status).toBe("done")
    expect(run?.saida).toMatchObject({ propostas: [] })
  })

  it("com anotação cria a linha, a etapa, a pendência e pausa; a saída não leva propostas_do_agente", async () => {
    const m = await montar()
    const saida = {
      ...saidaDeCodigo("Oi.", [casaTem]),
      propostas_do_agente: [rotina("acordo cedo")],
    }
    const vistos: string[] = []
    const final = await fecharComPropostas(
      m.deps,
      pedido(m, { saida, aoVivo: (e) => vistos.push(e.tipo) }),
    )
    const run = await m.stores.runs.buscar(m.conta.id, m.run.id)
    expect(run?.status).toBe("waiting_for_approval")
    const linhas = await m.stores.proposals.doRun(m.conta.id, m.run.id)
    expect(linhas.map((l) => l.tool).sort()).toEqual(["casa.propor", "memoria.propor"])
    expect(linhas.every((l) => l.decisao === "pendente")).toBe(true)
    expect(run?.pendencia).toMatchObject({
      tipo: "aprovacao",
      conteudo: { propostas: expect.arrayContaining(linhas.map((l) => l.id)) },
    })
    const etapas = await m.stores.runs.etapas(m.conta.id, m.run.id)
    expect(etapas.map((e) => [e.tipo, e.nome, e.resumo])).toEqual([
      ["proposta", "casa.propor", "casa: 1 item"],
      ["proposta", "memoria.propor", "rotina"],
    ])
    expect(vistos).toEqual([
      "etapa_iniciada",
      "etapa_concluida",
      "etapa_iniciada",
      "etapa_concluida",
    ])
    expect(final.propostas).toHaveLength(2)
    expect("propostas_do_agente" in final).toBe(false)
    expect(run?.saida).toEqual(final)
    expect(m.telemetry.eventos.filter((e) => e.nome === "pausa")).toHaveLength(1)
    const pausas = m.telemetry.metricas.filter((x) => x.nome === "ritu_pausas_total")
    expect(pausas[0]?.rotulos).toMatchObject({ tipo: "aprovacao" })
  })

  it("com incômodo ou em caminho sem proposta, nenhuma linha e done", async () => {
    for (const extra of [{ comIncomodo: true }, { caminho: "alerta" as const }]) {
      const m = await montar()
      const final = await fecharComPropostas(m.deps, pedido(m, extra))
      expect(final.propostas).toEqual([])
      expect(await m.stores.proposals.doRun(m.conta.id, m.run.id)).toEqual([])
      expect((await m.stores.runs.buscar(m.conta.id, m.run.id))?.status).toBe("done")
    }
  })

  it("com 8 anotações e propostas, o bloco tem 6 linhas", async () => {
    const m = await montar()
    const itens = [{ nome: "a" }]
    const anotacoes: Anotacao[] = [
      casaTem,
      { tipo: "casa_acabou", itens },
      { tipo: "nao_come", itens },
      { tipo: "restricao", itens: ["vegetariana"] },
      { tipo: "evitar_sempre", itens: [{ tipo: "texto", valor: "x" }] },
    ]
    const saida = {
      ...saidaDeCodigo("Oi.", anotacoes),
      propostas_do_agente: [rotina("um"), rotina("dois"), rotina("três")],
    }
    const final = await fecharComPropostas(m.deps, pedido(m, { anotacoes, saida }))
    expect(final.propostas).toHaveLength(6)
    expect(await m.stores.proposals.doRun(m.conta.id, m.run.id)).toHaveLength(6)
  })

  it("com para_ter, a linha da lista entra no bloco e o run vai a waiting_for_approval", async () => {
    const m = await montar()
    const saida = {
      ...saidaDeCodigo("Oi.", [casaTem]),
      para_ter: {
        alimento_id: "mel",
        nome: "Mel",
        vezes: 3,
        contribui: [],
        linha_base: "alimentos:mel",
        verbos: [],
        motivo: "x",
      },
    }
    const final = await fecharComPropostas(m.deps, pedido(m, { saida }))
    const run = await m.stores.runs.buscar(m.conta.id, m.run.id)
    expect(run?.status).toBe("waiting_for_approval")
    const linhas = await m.stores.proposals.doRun(m.conta.id, m.run.id)
    expect(linhas.map((l) => l.tool)).toEqual(["casa.propor", "lista.propor"])
    expect(linhas[1]?.conteudo).toEqual({
      alimento_id: "mel",
      motivo: "fez_falta",
      detalhe: "3",
    })
    expect(final.propostas.map((p) => p.tool)).toEqual(["casa.propor", "lista.propor"])
  })

  it("com para_ter e incômodo, nenhuma linha e done", async () => {
    const m = await montar()
    const saida = {
      ...saidaDeCodigo("Oi.", []),
      para_ter: {
        alimento_id: "mel",
        nome: "Mel",
        vezes: 3,
        contribui: [],
        linha_base: "alimentos:mel",
        verbos: [],
        motivo: "x",
      },
    }
    const final = await fecharComPropostas(
      m.deps,
      pedido(m, { saida, anotacoes: [], comIncomodo: true }),
    )
    expect(final.propostas).toEqual([])
    expect(await m.stores.proposals.doRun(m.conta.id, m.run.id)).toEqual([])
    expect((await m.stores.runs.buscar(m.conta.id, m.run.id))?.status).toBe("done")
  })

  it("nenhum resumo, span, métrica ou log leva o texto da pessoa", async () => {
    const m = await montar()
    await fecharComPropostas(m.deps, pedido(m))
    const etapas = await m.stores.runs.etapas(m.conta.id, m.run.id)
    const tudo = JSON.stringify([etapas, m.telemetry.spans, m.telemetry.metricas, m.telemetry.logs])
    expect(tudo).not.toContain(SEGREDO)
  })
})

describe("fecharOuFalhar", () => {
  it("falha ao criar as linhas: run failed e a saída segue sem propostas", async () => {
    const m = await montar()
    vi.spyOn(m.stores.proposals, "criar").mockRejectedValue(new Error("banco fora"))
    const final = await fecharOuFalhar(m.deps, pedido(m))
    expect(final.propostas).toEqual([])
    const run = await m.stores.runs.buscar(m.conta.id, m.run.id)
    expect(run?.status).toBe("failed")
    expect(run?.saida).toEqual(final)
  })
})
