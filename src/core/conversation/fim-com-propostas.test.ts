import { describe, expect, it, vi } from "vitest"
import { saidaDeCodigo } from "@/core/agents/companion/saida"
import { filtroVazio } from "@/core/knowledge/filtros"
import { padraoParaOBloco } from "@/core/patterns/bloco"
import { chaveDeAjuda } from "@/core/patterns/textos"
import type { Anotacao } from "@/core/proposals/anotacao"
import type { Run } from "@/core/runs/ports"
import { createRunService } from "@/core/runs/run-service"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { fecharComPropostas, fecharOuFalhar, filtroDoRun } from "./fim-com-propostas"

vi.mock("@/core/patterns/bloco", async (original) => {
  const real = await original<typeof import("@/core/patterns/bloco")>()
  return { padraoParaOBloco: vi.fn(real.padraoParaOBloco) }
})

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
  const deps = { stores, kb, runs, telemetry, clock }
  return { stores, telemetry, runs, conta, run, deps, clock }
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

  it("a etapa de um padrão confirmado tem resumo padrao, sem a frase", async () => {
    const m = await montar()
    const padrao = {
      tool: "padrao.confirmar" as const,
      padrao_id: "padrao-1",
      frase: `Quando você está pesada, ${SEGREDO} costuma estar também sem energia.`,
    }
    const saida = { ...saidaDeCodigo("Oi.", []), propostas_do_agente: [padrao] }
    await fecharComPropostas(m.deps, pedido(m, { saida, anotacoes: [] }))
    const etapas = await m.stores.runs.etapas(m.conta.id, m.run.id)
    expect(etapas.map((e) => [e.tipo, e.nome, e.resumo])).toEqual([
      ["proposta", "padrao.confirmar", "padrao"],
    ])
    expect(JSON.stringify(etapas)).not.toContain(SEGREDO)
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

describe("padrão no fim do run", () => {
  const CHAVE = chaveDeAjuda(["com_frio", "agitada"], { tipo: "pratica", id: "cha-gengibre" })

  async function candidato(m: M, chave = CHAVE) {
    const p = await m.stores.patterns.propor(m.conta.id, {
      tipo: "ajuda_em_estado",
      chave,
      frase: "Quando você está com frio e agitada, chá de gengibre costuma te ajudar.",
      ocorrencias: 3,
    })
    if (!p) throw new Error("padrão não criado")
    return p
  }
  const doAgente = (m: M, extra: Partial<Parameters<typeof fecharComPropostas>[1]> = {}) =>
    pedido(m, {
      anotacoes: [],
      saida: { ...saidaDeCodigo("Oi.", []), origem: "agente" as const },
      filtro: filtroVazio,
      ...extra,
    })

  it("um candidato válido vira a última linha e pausa o run mesmo sem outra proposta", async () => {
    vi.mocked(padraoParaOBloco).mockClear()
    const m = await montar()
    const p = await candidato(m)
    const final = await fecharComPropostas(m.deps, doAgente(m))
    expect((await m.stores.runs.buscar(m.conta.id, m.run.id))?.status).toBe("waiting_for_approval")
    const linhas = await m.stores.proposals.doRun(m.conta.id, m.run.id)
    expect(linhas.map((l) => l.tool)).toEqual(["padrao.confirmar"])
    expect(linhas[0]?.conteudo).toMatchObject({ padrao_id: p.id })
    expect(final.propostas.map((x) => x.tool)).toEqual(["padrao.confirmar"])
    const etapas = await m.stores.runs.etapas(m.conta.id, m.run.id)
    expect(etapas.map((e) => e.resumo)).toEqual(["padrao"])
  })

  it("vem depois das outras linhas", async () => {
    const m = await montar()
    await candidato(m)
    const final = await fecharComPropostas(
      m.deps,
      doAgente(m, {
        anotacoes: [casaTem],
        saida: { ...saidaDeCodigo("Oi.", [casaTem]), origem: "agente" as const },
      }),
    )
    expect(final.propostas.map((x) => x.tool)).toEqual(["casa.propor", "padrao.confirmar"])
  })

  it("dois candidatos: só o mais antigo", async () => {
    const m = await montar()
    const a = await candidato(m)
    m.clock.set("2026-11-15T19:00:00.000Z")
    await candidato(m, chaveDeAjuda(["seca"], { tipo: "pratica", id: "cha-gengibre" }))
    await fecharComPropostas(m.deps, doAgente(m))
    const linhas = await m.stores.proposals.doRun(m.conta.id, m.run.id)
    expect(linhas).toHaveLength(1)
    expect(linhas[0]?.conteudo).toMatchObject({ padrao_id: a.id })
  })

  it("com 6 linhas comuns o padrão não é criado; no dia seguinte ele aparece", async () => {
    const m = await montar()
    await candidato(m)
    const anotacoes: Anotacao[] = Array.from({ length: 6 }, (_, i) => ({
      tipo: "casa_tem" as const,
      itens: [{ nome: `item-${i}` }],
    }))
    const cheio = {
      anotacoes,
      saida: { ...saidaDeCodigo("Oi.", anotacoes), origem: "agente" as const },
    }
    await fecharComPropostas(m.deps, doAgente(m, cheio))
    const linhas = await m.stores.proposals.doRun(m.conta.id, m.run.id)
    expect(linhas.some((l) => l.tool === "padrao.confirmar")).toBe(false)
    expect(await m.stores.proposals.porTool(m.conta.id, "padrao.confirmar")).toEqual([])
    m.clock.set("2026-11-16T18:00:00.000Z")
    const run2 = await m.runs.iniciarRun(m.conta.id, { caminho: "acompanhante", intencoes: [] })
    await fecharComPropostas(m.deps, doAgente(m, { runId: run2.id }))
    expect((await m.stores.proposals.doRun(m.conta.id, run2.id)).map((l) => l.tool)).toEqual([
      "padrao.confirmar",
    ])
  })

  it("proposta criada hoje: não de novo no mesmo dia; no dia seguinte sim", async () => {
    const m = await montar()
    await candidato(m)
    await fecharComPropostas(m.deps, doAgente(m))
    const run2 = await m.runs.iniciarRun(m.conta.id, { caminho: "acompanhante", intencoes: [] })
    await fecharComPropostas(m.deps, doAgente(m, { runId: run2.id }))
    expect(await m.stores.proposals.doRun(m.conta.id, run2.id)).toEqual([])
    m.clock.set("2026-11-16T18:00:00.000Z")
    const run3 = await m.runs.iniciarRun(m.conta.id, { caminho: "acompanhante", intencoes: [] })
    await fecharComPropostas(m.deps, doAgente(m, { runId: run3.id }))
    expect(await m.stores.proposals.doRun(m.conta.id, run3.id)).toHaveLength(1)
  })

  it("três propostas antigas sem resposta: não aparece mais e segue candidato", async () => {
    const m = await montar()
    const p = await candidato(m)
    for (const dia of ["12", "13", "14"]) {
      m.clock.set(`2026-11-${dia}T18:00:00.000Z`)
      await m.stores.proposals.criar(m.conta.id, m.run.id, [
        { tool: "padrao.confirmar", conteudo: { padrao_id: p.id, frase: "x" } },
      ])
    }
    m.clock.set("2026-11-15T18:00:00.000Z")
    const final = await fecharComPropostas(m.deps, doAgente(m))
    expect(final.propostas).toEqual([])
    expect(await m.stores.patterns.listar(m.conta.id, "candidato")).toHaveLength(1)
  })

  it("candidato barrado pelo filtro não aparece", async () => {
    const m = await montar()
    await candidato(m)
    const final = await fecharComPropostas(
      m.deps,
      doAgente(m, { filtro: { ...filtroVazio, nao_come: ["gengibre"] } }),
    )
    expect(final.propostas).toEqual([])
  })

  it("caminho casa/retorno, saída não agente e run com incômodo: sem linha e sem chamar", async () => {
    const casos: Partial<Parameters<typeof fecharComPropostas>[1]>[] = [
      { caminho: "casa" },
      { caminho: "retorno" },
      { saida: { ...saidaDeCodigo("Oi.", []), origem: "segura" } },
      { saida: { ...saidaDeCodigo("Oi.", []), origem: "sem_modelo" } },
      { saida: { ...saidaDeCodigo("Oi.", []), origem: "codigo" } },
      { comIncomodo: true },
    ]
    for (const extra of casos) {
      vi.mocked(padraoParaOBloco).mockClear()
      const m = await montar()
      await candidato(m)
      const final = await fecharComPropostas(m.deps, doAgente(m, extra))
      expect(final.propostas).toEqual([])
      expect(padraoParaOBloco).not.toHaveBeenCalled()
    }
  })

  it("sem filtro no pedido, monta o do dia e o padrão entra", async () => {
    const m = await montar()
    await candidato(m)
    const final = await fecharComPropostas(m.deps, doAgente(m, { filtro: undefined }))
    expect(final.propostas.map((x) => x.tool)).toEqual(["padrao.confirmar"])
  })

  it("sem filtro no pedido, item em evitar_sempre do perfil barra o padrão", async () => {
    const m = await montar()
    await candidato(m)
    await m.stores.profiles.acrescentarEvitarSempre(m.conta.id, [
      { tipo: "alimento", valor: "gengibre" },
    ])
    const final = await fecharComPropostas(m.deps, doAgente(m, { filtro: undefined }))
    expect(final.propostas).toEqual([])
  })

  it("sem filtro no pedido, item na lista temporária do dia barra o padrão", async () => {
    const m = await montar()
    await candidato(m)
    await m.stores.profiles.acrescentarEvitarTemporario(m.conta.id, "2026-11-15", [
      { tipo: "alimento", valor: "gengibre" },
    ])
    const final = await fecharComPropostas(m.deps, doAgente(m, { filtro: undefined }))
    expect(final.propostas).toEqual([])
  })
})

describe("filtroDoRun", () => {
  const run = (dados: unknown) => ({ checkpoint: { dados } }) as unknown as Run

  it("lê o filtro do checkpoint", () => {
    expect(filtroDoRun(run({ filtro: filtroVazio }))).toEqual(filtroVazio)
  })

  it("sem filtro válido ou sem checkpoint, undefined", () => {
    expect(filtroDoRun(run({}))).toBeUndefined()
    expect(filtroDoRun(run({ filtro: { evitar: 1 } }))).toBeUndefined()
    expect(filtroDoRun({ checkpoint: null } as unknown as Run)).toBeUndefined()
  })
})
