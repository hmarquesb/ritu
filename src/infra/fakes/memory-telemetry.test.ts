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
    t.histograma("ritu_run_passos", 3, { caminho: "conversa" })
    t.evento("pausa", { "pausa.tipo": "pergunta" })
    t.log("info", "run_fim", { "run.id": "r1" })

    expect(t.metricas).toHaveLength(2)
    expect(t.metricas[0]).toMatchObject({ nome: "ritu_pausas_total", valor: 1 })
    expect(t.eventos).toHaveLength(1)
    expect(t.logs[0]).toMatchObject({ nivel: "info", codigo: "run_fim" })
  })
})
