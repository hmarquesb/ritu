import { describe, expect, it, vi } from "vitest"
import { RituError } from "@/core/errors"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import type { Deps } from "./deps"
import { type AcaoDaMemoria, acaoDaMemoriaSchema, tocarMemoria } from "./memoria"

const CONTA = "conta-1"
const FUSO = "America/Sao_Paulo"
const NOTA = "11111111-1111-4111-8111-111111111111"
const PADRAO = "22222222-2222-4222-8222-222222222222"

// Hoje, no fuso de São Paulo, é 10 de maio de 2026.
function montar() {
  const clock = createFixedClock("2026-05-10T12:00:00Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const kb = createMiniKnowledge()
  const deps: Deps = { tx: stores, stores, kb, clock, telemetry }
  const routine = {
    apagarNota: vi.fn(async (..._args: unknown[]) => undefined),
    corrigirNota: vi.fn(async (c: string, n: string, t: string) => ({
      id: n,
      conta_id: c,
      texto: t,
      ativa: true,
      criado_em: "2026-05-10T12:00:00Z",
    })),
  }
  const patterns = {
    decidirPadrao: vi.fn(async (..._args: unknown[]) => undefined),
    apagarPadrao: vi.fn(async (..._args: unknown[]) => undefined),
  }
  return { stores, telemetry, deps, routine, patterns, kb }
}

type Montado = ReturnType<typeof montar>

const executar = (m: Montado, acao: AcaoDaMemoria) =>
  tocarMemoria({ ...m.deps, routine: m.routine, patterns: m.patterns }, CONTA, acao, FUSO)

async function erroDe(promessa: Promise<unknown>): Promise<unknown> {
  try {
    await promessa
  } catch (erro) {
    return erro
  }
  throw new Error("deveria ter lançado")
}

const metricasDeMemoria = (m: Montado) =>
  m.telemetry.metricas.filter((x) => x.nome === "ritu_memoria_edicoes_total")

describe("acaoDaMemoriaSchema", () => {
  it("aceita as oito ações com o formato do contrato", () => {
    const exemplos: unknown[] = [
      { acao: "gosto", item_tipo: "alimento", item_id: "leite", gosto: "gosta" },
      { acao: "esquecer", item_tipo: "pratica", item_id: "pranayama" },
      { acao: "falta_apagar", alimento_id: "cardamomo" },
      { acao: "nota_corrigir", nota_id: NOTA, texto: "Caminhada leve" },
      { acao: "nota_apagar", nota_id: NOTA },
      { acao: "padrao_decidir", padrao_id: PADRAO, decisao: "confirmado" },
      { acao: "padrao_apagar", padrao_id: PADRAO },
      { acao: "conversa_apagar", dia: "2026-05-09" },
    ]
    for (const exemplo of exemplos) {
      expect(acaoDaMemoriaSchema.safeParse(exemplo).success).toBe(true)
    }
  })

  it("recusa campo a mais e id que não é uuid", () => {
    expect(
      acaoDaMemoriaSchema.safeParse({ acao: "nota_apagar", nota_id: "nao-uuid" }).success,
    ).toBe(false)
    expect(
      acaoDaMemoriaSchema.safeParse({ acao: "falta_apagar", alimento_id: "x", extra: 1 }).success,
    ).toBe(false)
  })
})

describe("tocarMemoria: gosto e esquecer", () => {
  it("gosto grava o gosto do item e conta como gostos", async () => {
    const m = montar()
    const resultado = await executar(m, {
      acao: "gosto",
      item_tipo: "alimento",
      item_id: "leite",
      gosto: "gosta",
    })

    const prefs = await m.stores.preferences.ler(CONTA, [{ tipo: "alimento", id: "leite" }])
    expect(prefs[0]?.gosto).toBe("gosta")
    expect(resultado.nome).toBe(m.kb.alimento("leite")?.nome)
    expect(metricasDeMemoria(m).map((x) => x.rotulos)).toEqual([{ nivel: "gostos", acao: "gosto" }])
  })

  it("gosto fora da base é toque_invalido e não conta", async () => {
    const m = montar()
    const erro = await erroDe(
      executar(m, { acao: "gosto", item_tipo: "alimento", item_id: "nada-disso", gosto: null }),
    )

    expect(erro).toBeInstanceOf(RituError)
    expect((erro as RituError).code).toBe("toque_invalido")
    expect(metricasDeMemoria(m)).toEqual([])
  })

  it("esquecer apaga a preferência do item e conta como gostos", async () => {
    const m = montar()
    await m.stores.preferences.definirGosto(CONTA, { tipo: "alimento", id: "leite" }, "nao_gosta")
    await executar(m, { acao: "esquecer", item_tipo: "alimento", item_id: "leite" })

    const prefs = await m.stores.preferences.ler(CONTA, [{ tipo: "alimento", id: "leite" }])
    expect(prefs).toEqual([])
    expect(metricasDeMemoria(m).map((x) => x.rotulos)).toEqual([
      { nivel: "gostos", acao: "esquecer" },
    ])
  })

  it("esquecer fora da base é toque_invalido", async () => {
    const m = montar()
    const erro = await erroDe(
      executar(m, { acao: "esquecer", item_tipo: "preparo", item_id: "nada-disso" }),
    )

    expect((erro as RituError).code).toBe("toque_invalido")
    expect(metricasDeMemoria(m)).toEqual([])
  })
})

describe("tocarMemoria: falta_apagar", () => {
  it("apaga a falta do alimento e conta como faltas", async () => {
    const m = montar()
    const apagar = vi.spyOn(m.stores.shortages, "apagarDoAlimento")
    await executar(m, { acao: "falta_apagar", alimento_id: "cardamomo" })

    expect(apagar).toHaveBeenCalledWith(CONTA, "cardamomo")
    expect(metricasDeMemoria(m).map((x) => x.rotulos)).toEqual([
      { nivel: "faltas", acao: "falta_apagar" },
    ])
  })

  it("alimento fora da base é toque_invalido", async () => {
    const m = montar()
    const apagar = vi.spyOn(m.stores.shortages, "apagarDoAlimento")
    const erro = await erroDe(executar(m, { acao: "falta_apagar", alimento_id: "nada-disso" }))

    expect((erro as RituError).code).toBe("toque_invalido")
    expect(apagar).not.toHaveBeenCalled()
    expect(metricasDeMemoria(m)).toEqual([])
  })
})

describe("tocarMemoria: notas e padrões", () => {
  it("nota_corrigir delega à rotina e conta como rotina", async () => {
    const m = montar()
    await executar(m, { acao: "nota_corrigir", nota_id: NOTA, texto: "Caminhada leve" })

    expect(m.routine.corrigirNota).toHaveBeenCalledWith(CONTA, NOTA, "Caminhada leve")
    expect(metricasDeMemoria(m).map((x) => x.rotulos)).toEqual([
      { nivel: "rotina", acao: "nota_corrigir" },
    ])
  })

  it("nota_corrigir recusada pela rotina propaga o erro e não conta", async () => {
    const m = montar()
    m.routine.corrigirNota.mockRejectedValueOnce(new RituError("nota_invalida", "Nota inválida"))
    const erro = await erroDe(executar(m, { acao: "nota_corrigir", nota_id: NOTA, texto: "x" }))

    expect((erro as RituError).code).toBe("nota_invalida")
    expect(metricasDeMemoria(m)).toEqual([])
  })

  it("nota_apagar delega à rotina e conta como rotina", async () => {
    const m = montar()
    await executar(m, { acao: "nota_apagar", nota_id: NOTA })

    expect(m.routine.apagarNota).toHaveBeenCalledWith(CONTA, NOTA)
    expect(metricasDeMemoria(m).map((x) => x.rotulos)).toEqual([
      { nivel: "rotina", acao: "nota_apagar" },
    ])
  })

  it("padrao_decidir delega ao padrão e conta como padroes", async () => {
    const m = montar()
    await executar(m, { acao: "padrao_decidir", padrao_id: PADRAO, decisao: "recusado" })

    expect(m.patterns.decidirPadrao).toHaveBeenCalledWith(CONTA, PADRAO, "recusado")
    expect(metricasDeMemoria(m).map((x) => x.rotulos)).toEqual([
      { nivel: "padroes", acao: "padrao_decidir" },
    ])
  })

  it("padrao_apagar delega ao padrão e conta como padroes", async () => {
    const m = montar()
    await executar(m, { acao: "padrao_apagar", padrao_id: PADRAO })

    expect(m.patterns.apagarPadrao).toHaveBeenCalledWith(CONTA, PADRAO)
    expect(metricasDeMemoria(m).map((x) => x.rotulos)).toEqual([
      { nivel: "padroes", acao: "padrao_apagar" },
    ])
  })

  it("padrao recusado pelo padrão propaga o erro e não conta", async () => {
    const m = montar()
    m.patterns.apagarPadrao.mockRejectedValueOnce(
      new RituError("padrao_invalido", "Padrão inválido"),
    )
    const erro = await erroDe(executar(m, { acao: "padrao_apagar", padrao_id: PADRAO }))

    expect((erro as RituError).code).toBe("padrao_invalido")
    expect(metricasDeMemoria(m)).toEqual([])
  })
})

describe("tocarMemoria: conversa_apagar", () => {
  it("apaga as mensagens e tira os runs do dia numa transação, e conta como conversa", async () => {
    const m = montar()
    const emTransacao = vi.spyOn(m.deps.tx, "emTransacao")
    const apagarMensagens = vi.spyOn(m.stores.messages, "apagarDoDia")
    const tirar = vi.spyOn(m.stores.runs, "tirarDaConversa")

    await executar(m, { acao: "conversa_apagar", dia: "2026-05-09" })

    expect(emTransacao).toHaveBeenCalledOnce()
    expect(apagarMensagens).toHaveBeenCalledWith(CONTA, "2026-05-09")
    expect(tirar).toHaveBeenCalledWith(CONTA, "2026-05-09")
    expect(metricasDeMemoria(m).map((x) => x.rotulos)).toEqual([
      { nivel: "conversa", acao: "conversa_apagar" },
    ])
  })

  it("hoje é dia da janela", async () => {
    const m = montar()
    await executar(m, { acao: "conversa_apagar", dia: "2026-05-10" })

    expect(metricasDeMemoria(m)).toHaveLength(1)
  })

  it("o sexto dia atrás ainda está na janela e o sétimo já não", async () => {
    const dentro = montar()
    await executar(dentro, { acao: "conversa_apagar", dia: "2026-05-04" })
    expect(metricasDeMemoria(dentro)).toHaveLength(1)

    const fora = montar()
    const erro = await erroDe(executar(fora, { acao: "conversa_apagar", dia: "2026-05-03" }))
    expect((erro as RituError).code).toBe("toque_invalido")
    expect(metricasDeMemoria(fora)).toEqual([])
  })

  it("dia futuro é toque_invalido", async () => {
    const m = montar()
    const apagarMensagens = vi.spyOn(m.stores.messages, "apagarDoDia")
    const erro = await erroDe(executar(m, { acao: "conversa_apagar", dia: "2026-05-11" }))

    expect((erro as RituError).code).toBe("toque_invalido")
    expect(apagarMensagens).not.toHaveBeenCalled()
  })

  it("com run aberto no dia é conversa_em_andamento e não apaga nada", async () => {
    const m = montar()
    await m.stores.runs.criar(CONTA, { caminho: "acompanhante", intencoes: [], dia: "2026-05-09" })
    const apagarMensagens = vi.spyOn(m.stores.messages, "apagarDoDia")
    const tirar = vi.spyOn(m.stores.runs, "tirarDaConversa")
    const erro = await erroDe(executar(m, { acao: "conversa_apagar", dia: "2026-05-09" }))

    expect((erro as RituError).code).toBe("conversa_em_andamento")
    expect(apagarMensagens).not.toHaveBeenCalled()
    expect(tirar).not.toHaveBeenCalled()
    expect(metricasDeMemoria(m)).toEqual([])
  })

  it("run aberto de outro dia não bloqueia", async () => {
    const m = montar()
    await m.stores.runs.criar(CONTA, { caminho: "acompanhante", intencoes: [], dia: "2026-05-10" })
    await executar(m, { acao: "conversa_apagar", dia: "2026-05-09" })

    expect(metricasDeMemoria(m)).toHaveLength(1)
  })
})

describe("tocarMemoria: span", () => {
  it("abre o span toque com tipo memoria e a acao", async () => {
    const m = montar()
    await executar(m, { acao: "nota_apagar", nota_id: NOTA })

    const span = m.telemetry.spans.find((s) => s.nome === "toque")
    expect(span?.atributos).toEqual({ tipo: "memoria", acao: "nota_apagar" })
  })
})
