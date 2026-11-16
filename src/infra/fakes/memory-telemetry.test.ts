import { describe, expect, it } from "vitest"
import type { Atributos } from "@/core/telemetry/ports"
import { createMemoryTelemetry } from "./memory-telemetry"

const forjado = (a: Record<string, unknown>) => a as unknown as Atributos

describe("createMemoryTelemetry", () => {
  it("span aninhado registra o índice do pai", async () => {
    const t = createMemoryTelemetry()

    await t.span("run", { "run.id": "r1" }, async () => {
      await t.span("agente.passo", { "passo.ordem": 1 }, async () => {})
    })

    expect(t.spans).toHaveLength(2)
    expect(t.spans[0]?.pai).toBeUndefined()
    expect(t.spans[1]?.pai).toBe(0)
  })

  it("span com traceparent reaproveita o trace de origem", async () => {
    const t = createMemoryTelemetry()

    const tp = await t.span("run", { "run.id": "r1" }, async () => t.traceparentAtual())
    await t.span("run", { "run.id": "r1" }, async () => {}, { traceparent: tp })

    expect(tp).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/)
    expect(t.spans[1]?.trace).toBe(t.spans[0]?.trace)
  })

  it("atributo fora da lista lança", async () => {
    const t = createMemoryTelemetry()

    await expect(t.span("run", forjado({ texto: "oi" }), async () => {})).rejects.toThrow(
      "atributo_proibido",
    )
  })

  it("texto com 65 caracteres lança e com 64 passa", async () => {
    const t = createMemoryTelemetry()

    await expect(t.span("run", { "run.id": "a".repeat(65) }, async () => {})).rejects.toThrow(
      "atributo_proibido",
    )
    await expect(
      t.span("run", { "run.id": "a".repeat(64) }, async () => {}),
    ).resolves.toBeUndefined()
  })

  it("atribuir valida atributos e falhar registra o código", async () => {
    const t = createMemoryTelemetry()

    await t.span("tool.chamada", { "tool.nome": "clima" }, async (s) => {
      s.atribuir({ "tool.status": "ok" })
      s.falhar("timeout")
      expect(() => s.atribuir(forjado({ texto: "x" }))).toThrow("atributo_proibido")
    })

    expect(t.spans[0]?.atributos).toEqual({ "tool.nome": "clima", "tool.status": "ok" })
    expect(t.spans[0]?.falha).toBe("timeout")
  })

  it("guarda métricas, eventos e logs", () => {
    const t = createMemoryTelemetry()

    t.contador("ritu_pausas_total", { tipo: "pergunta" })
    t.histograma("ritu_run_passos", 3, { caminho: "conversa", status: "done" })
    t.evento("pausa", { "pausa.tipo": "pergunta" })
    t.log("run_fim", { "run.status": "done" })

    expect(t.metricas).toHaveLength(2)
    expect(t.metricas[0]).toMatchObject({ nome: "ritu_pausas_total", valor: 1 })
    expect(t.eventos).toHaveLength(1)
    expect(t.logs[0]).toMatchObject({ nivel: "info", codigo: "run_fim" })
  })

  it("rotulos_invalidos com rótulo a menos, a mais e trocado", () => {
    const t = createMemoryTelemetry()

    expect(() => t.histograma("ritu_run_passos", 1, { caminho: "conversa" })).toThrow(
      "rotulos_invalidos: ritu_run_passos",
    )
    expect(() => t.contador("ritu_pausas_total", { tipo: "pergunta", status: "x" })).toThrow(
      "rotulos_invalidos: ritu_pausas_total",
    )
    expect(() => t.contador("ritu_pausas_total", { "pausa.tipo": "pergunta" })).toThrow(
      "rotulos_invalidos: ritu_pausas_total",
    )
    expect(() => t.contador("ritu_pausas_total")).toThrow("rotulos_invalidos")
  })

  it("contador sem rótulo passa em métrica sem rótulos", () => {
    const t = createMemoryTelemetry()

    t.contador("ritu_fallback_sem_llm_total")

    expect(t.metricas[0]?.rotulos).toEqual({})
  })

  it("log dentro de run ganha run.id e trace_id, inclusive em span filho", async () => {
    const t = createMemoryTelemetry()

    await t.span("run", { "run.id": "r1" }, async () => {
      await t.span("agente.passo", { "passo.ordem": 1 }, async () => {
        t.log("sem_modelo", { papel: "decisao" })
      })
    })

    expect(t.logs[0]?.campos).toEqual({
      papel: "decisao",
      "run.id": "r1",
      trace_id: t.spans[0]?.trace,
    })
  })

  it("run.id atribuído depois chega ao log seguinte", async () => {
    const t = createMemoryTelemetry()

    await t.span("run", {}, async (s) => {
      t.log("run_inicio")
      s.atribuir({ "run.id": "r2" })
      t.log("run_inicio")
    })

    expect(t.logs[0]?.campos["run.id"]).toBeUndefined()
    expect(t.logs[1]?.campos["run.id"]).toBe("r2")
  })

  it("log fora de span não ganha nada e o nível vem de LOGS", () => {
    const t = createMemoryTelemetry()

    t.log("run_falhou", { "erro.codigo": "x" })
    t.log("sem_modelo", { papel: "decisao" })

    expect(t.logs[0]).toEqual({
      codigo: "run_falhou",
      nivel: "error",
      campos: { "erro.codigo": "x" },
    })
    expect(t.logs[1]?.nivel).toBe("warn")
  })

  it("log com campo proibido lança", () => {
    const t = createMemoryTelemetry()

    expect(() => t.log("run_fim", forjado({ texto: "oi" }))).toThrow("atributo_proibido")
  })

  it("atribuirAoSpanAtual muda o span filho e não faz nada fora de span", async () => {
    const t = createMemoryTelemetry()

    t.atribuirAoSpanAtual({ "run.caminho": "x" })
    await t.span("run", { "run.id": "r1" }, async () => {
      await t.span("agente.passo", {}, async () => {
        t.atribuirAoSpanAtual({ "passo.ordem": 2 })
      })
    })

    expect(t.spans[0]?.atributos).toEqual({ "run.id": "r1" })
    expect(t.spans[1]?.atributos).toEqual({ "passo.ordem": 2 })
  })
})
