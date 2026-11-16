import { describe, expect, it } from "vitest"
import { createNullTelemetry } from "./null-telemetry"

describe("createNullTelemetry", () => {
  it("span devolve o valor de fn", async () => {
    const t = createNullTelemetry()

    await expect(t.span("run", { "run.id": "r1" }, async () => 42)).resolves.toBe(42)
  })

  it("o SpanAtivo recebido aceita atribuir e falhar sem efeito", async () => {
    const t = createNullTelemetry()

    await t.span("juiz", {}, async (s) => {
      s.atribuir({ "juiz.aprovado": true })
      s.falhar("erro")
    })
  })

  it("demais métodos não fazem nada e traceparent é indefinido", async () => {
    const t = createNullTelemetry()

    t.evento("pausa")
    t.contador("ritu_fallback_sem_llm_total")
    t.histograma("ritu_run_passos", 2)
    t.atribuirAoSpanAtual({ "run.id": "r1" })
    t.medidor("ritu_llm_cota_usada", 1)
    t.log("sem_modelo", { papel: "decisao" })

    expect(t.traceparentAtual()).toBeUndefined()
    await expect(t.encerrar()).resolves.toBeUndefined()
  })
})
