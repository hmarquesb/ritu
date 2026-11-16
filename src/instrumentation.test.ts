import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const registerOTel = vi.fn()
const opcoes = vi.fn()
vi.mock("@vercel/otel", () => ({ registerOTel }))
vi.mock("./infra/otel/opcoes", () => ({
  opcoesDoOtel: (...a: unknown[]) => {
    opcoes(...a)
    return {
      traceExporter: { t: 1 },
      metricReader: { m: 1 },
      logRecordProcessor: { l: 1 },
      resource: { attributes: { "service.instance.id": "abc" } },
    }
  },
}))

describe("register", () => {
  const guardado = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  beforeEach(() => {
    registerOTel.mockClear()
    opcoes.mockClear()
  })
  afterEach(() => {
    if (guardado === undefined) delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    else process.env.OTEL_EXPORTER_OTLP_ENDPOINT = guardado
  })

  it("com endpoint liga traces, métricas e logs", async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318"
    const { register } = await import("./instrumentation")
    await register()
    expect(registerOTel).toHaveBeenCalledTimes(1)
    const c = registerOTel.mock.calls[0]?.[0]
    expect(c.metricReaders).toHaveLength(1)
    expect(c.logRecordProcessors).toHaveLength(1)
    expect(c.traceExporter).toBeDefined()
  })

  it("sem endpoint não importa nada de OTel", async () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    const { register } = await import("./instrumentation")
    await register()
    expect(registerOTel).not.toHaveBeenCalled()
    expect(opcoes).not.toHaveBeenCalled()
  })
})
