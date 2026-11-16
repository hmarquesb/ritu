import { llmCotas } from "@config/llm-cotas"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { createModelRouter } from "@/core/llm/router"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { chamarApoio } from "./chamada-de-apoio"

const schema = z.object({ valor: z.string() })

function setup(respostas: unknown[], limites = {}) {
  const clock = createFixedClock("2026-06-01T20:00:10Z")
  const ledger = createMemoryLedger(clock, limites)
  const telemetry = createMemoryTelemetry()
  const router = createModelRouter({ ledger, clock, telemetry })
  const client = createFakeLlm(respostas)
  return { deps: { router, client, telemetry }, telemetry, client }
}

function rodar(deps: ReturnType<typeof setup>["deps"]) {
  return deps.telemetry.span("interprete", {}, (span) =>
    chamarApoio(deps, span, { instrucoes: "instrucoes", entrada: "entrada", schema }),
  )
}

describe("chamarApoio", () => {
  it("sucesso devolve dado, modelo, tokens e trocas do papel apoio", async () => {
    const { deps } = setup([{ valor: "ok" }])
    const r = await rodar(deps)
    expect(r).toEqual({
      ok: true,
      dado: { valor: "ok" },
      modelo: llmCotas.papeis.apoio[0],
      tokens: { entrada: 10, saida: 5 },
      trocas: 0,
    })
  })

  it("SemModeloError vira ok false com motivo sem_modelo e falha o span", async () => {
    const zero = { rpm: 0, tpm: 0, rpd: 0 }
    const limites = Object.fromEntries(llmCotas.papeis.apoio.map((m) => [m, zero]))
    const { deps, telemetry } = setup([], limites)
    expect(await rodar(deps)).toEqual({ ok: false, motivo: "sem_modelo" })
    expect(telemetry.spans.find((s) => s.nome === "interprete")?.falha).toBe("sem_modelo")
  })

  it("LlmError vira ok false com motivo erro e falha o span", async () => {
    const { deps, telemetry } = setup([{ erro: "indisponivel" }])
    expect(await rodar(deps)).toEqual({ ok: false, motivo: "erro" })
    expect(telemetry.spans.find((s) => s.nome === "interprete")?.falha).toBe("erro")
  })

  it("erro que não é do modelo sobe", async () => {
    const { deps } = setup([])
    await expect(rodar(deps)).rejects.toThrow("fake-llm")
  })
})
