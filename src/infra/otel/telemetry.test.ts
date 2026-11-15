import { context, propagation, trace } from "@opentelemetry/api"
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks"
import { W3CTraceContextPropagator } from "@opentelemetry/core"
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { createOtelTelemetry } from "./telemetry"

const exporter = new InMemorySpanExporter()
const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] })
const contextManager = new AsyncLocalStorageContextManager()

beforeAll(() => {
  context.setGlobalContextManager(contextManager.enable())
  propagation.setGlobalPropagator(new W3CTraceContextPropagator())
  trace.setGlobalTracerProvider(provider)
})

afterAll(async () => {
  await provider.shutdown()
  trace.disable()
  propagation.disable()
  context.disable()
})

beforeEach(() => {
  exporter.reset()
})

describe("createOtelTelemetry", () => {
  it("um span com traceparent cai no mesmo trace do pai", async () => {
    const telemetria = createOtelTelemetry()
    const traceparent = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"

    await telemetria.span("run", { "run.id": "r1" }, async () => {}, { traceparent })

    const [span] = exporter.getFinishedSpans()
    expect(span?.spanContext().traceId).toBe("0af7651916cd43dd8448eb211c80319c")
    expect(span?.parentSpanContext?.spanId).toBe("b7ad6b7169203331")
    expect(span?.attributes["run.id"]).toBe("r1")
  })

  it("traceparentAtual devolve o traceparent do span ativo e nada fora de span", async () => {
    const telemetria = createOtelTelemetry()
    expect(telemetria.traceparentAtual()).toBeUndefined()

    let dentro: string | undefined
    await telemetria.span("run", {}, async () => {
      dentro = telemetria.traceparentAtual()
    })

    const [span] = exporter.getFinishedSpans()
    expect(dentro).toBe(`00-${span?.spanContext().traceId}-${span?.spanContext().spanId}-01`)
  })

  it("um span aninhado fica sob o span pai", async () => {
    const telemetria = createOtelTelemetry()

    await telemetria.span("run", {}, () =>
      telemetria.span("agente.passo", { "passo.ordem": 1 }, async () => {}),
    )

    const spans = exporter.getFinishedSpans()
    const filho = spans.find((s) => s.name === "agente.passo")
    const pai = spans.find((s) => s.name === "run")
    expect(filho?.parentSpanContext?.spanId).toBe(pai?.spanContext().spanId)
  })

  it("descarta atributo fora da lista e atributo de texto longo, sem lançar", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {})
    const telemetria = createOtelTelemetry()

    await telemetria.span("run", { "run.id": "r1", mensagem: "oi" } as never, async (s) => {
      s.atribuir({ "tool.nome": "x".repeat(65) })
      s.atribuir({ "tool.status": "ok" })
    })

    const [span] = exporter.getFinishedSpans()
    expect(span?.attributes["run.id"]).toBe("r1")
    expect(span?.attributes.mensagem).toBeUndefined()
    expect(span?.attributes["tool.nome"]).toBeUndefined()
    expect(span?.attributes["tool.status"]).toBe("ok")
    const avisos = aviso.mock.calls.map((c) => String(c[0]))
    expect(avisos.some((l) => l.includes("atributo_proibido"))).toBe(true)
    expect(avisos.join("")).not.toContain("xxxxxxxx")
    aviso.mockRestore()
  })

  it("falhar marca o span com status ERROR e erro.codigo; erro lançado propaga", async () => {
    const telemetria = createOtelTelemetry()

    await telemetria.span("tool.chamada", {}, async (s) => {
      s.falhar("tool_falhou")
    })
    await expect(
      telemetria.span("llm.chamada", {}, async () => {
        throw new Error("boom com texto")
      }),
    ).rejects.toThrow("boom")

    const [a, b] = exporter.getFinishedSpans()
    expect(a?.status.code).toBe(2)
    expect(a?.attributes["erro.codigo"]).toBe("tool_falhou")
    expect(b?.status.code).toBe(2)
    expect(b?.status.message).not.toContain("texto")
  })

  it("métricas, evento e log sem SDK registrado não lançam", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const telemetria = createOtelTelemetry()

    expect(() => {
      telemetria.contador("ritu_pausas_total", { "pausa.tipo": "pergunta" })
      telemetria.histograma("ritu_run_duracao_ms", 12)
      telemetria.medidor("ritu_run_passos", 3)
      telemetria.evento("pausa", { "pausa.tipo": "pergunta" })
      telemetria.log("info", "run_iniciado", { "run.id": "r1" })
    }).not.toThrow()
    info.mockRestore()
  })

  it("encerrar resolve sem SDK registrado", async () => {
    await expect(createOtelTelemetry().encerrar()).resolves.toBeUndefined()
  })
})
