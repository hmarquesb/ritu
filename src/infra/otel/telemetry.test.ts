import { telemetria as limitesDoConfig } from "@config/telemetria"
import { context, metrics, propagation, trace } from "@opentelemetry/api"
import { logs } from "@opentelemetry/api-logs"
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks"
import { W3CTraceContextPropagator } from "@opentelemetry/core"
import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs"
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics"
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { createOtelTelemetry } from "./telemetry"

const exporter = new InMemorySpanExporter()
const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] })
const contextManager = new AsyncLocalStorageContextManager()
const logExporter = new InMemoryLogRecordExporter()
const loggerProvider = new LoggerProvider({
  processors: [new SimpleLogRecordProcessor({ exporter: logExporter })],
})
const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE)
const leitor = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 3_600_000,
})
const meterProvider = new MeterProvider({ readers: [leitor] })

beforeAll(() => {
  context.setGlobalContextManager(contextManager.enable())
  propagation.setGlobalPropagator(new W3CTraceContextPropagator())
  trace.setGlobalTracerProvider(provider)
  logs.setGlobalLoggerProvider(loggerProvider)
  metrics.setGlobalMeterProvider(meterProvider)
})

afterAll(async () => {
  await provider.shutdown()
  await meterProvider.shutdown()
  await loggerProvider.shutdown()
  logs.disable()
  metrics.disable()
  trace.disable()
  propagation.disable()
  context.disable()
})

beforeEach(() => {
  exporter.reset()
  logExporter.reset()
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
    const registros = logExporter.getFinishedLogRecords()
    expect(registros.some((l) => l.body === "atributo_proibido")).toBe(true)
    expect(JSON.stringify(registros.map((l) => l.attributes))).not.toContain("xxxxxxxx")
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
    const telemetria = createOtelTelemetry()

    expect(() => {
      telemetria.contador("ritu_pausas_total", { tipo: "pergunta" })
      telemetria.histograma("ritu_run_duracao_ms", 12, { caminho: "conversa", status: "done" })
      telemetria.medidor("ritu_llm_cota_usada", 3, { modelo: "m", janela: "dia" })
      telemetria.evento("pausa", { "pausa.tipo": "pergunta" })
      telemetria.log("run_inicio", { "run.id": "r1" })
    }).not.toThrow()
  })

  it("encerrar resolve sem SDK registrado", async () => {
    await expect(createOtelTelemetry().encerrar()).resolves.toBeUndefined()
  })

  const campoDoLog = (i: number) => logExporter.getFinishedLogRecords()[i]?.attributes

  it("log dentro de run ganha run.id e trace_id, também em span filho", async () => {
    const telemetria = createOtelTelemetry()

    await telemetria.span("run", { "run.id": "r1" }, () =>
      telemetria.span("agente.passo", { "passo.ordem": 1 }, async () => {
        telemetria.log("sem_modelo", { papel: "decisao" })
      }),
    )

    const traceId = exporter.getFinishedSpans()[0]?.spanContext().traceId
    expect(campoDoLog(0)).toMatchObject({ "run.id": "r1", trace_id: traceId, papel: "decisao" })
    expect(logExporter.getFinishedLogRecords()[0]?.severityText).toBe("WARN")
  })

  it("run.id atribuído depois chega ao log seguinte, e log fora de run não ganha run.id", async () => {
    const telemetria = createOtelTelemetry()

    await telemetria.span("run", {}, async (s) => {
      telemetria.log("run_inicio")
      s.atribuir({ "run.id": "r2" })
      telemetria.log("run_inicio")
      telemetria.atribuirAoSpanAtual({ "run.id": "r3" })
      telemetria.log("run_inicio")
    })
    telemetria.log("run_inicio")

    expect(campoDoLog(0)?.["run.id"]).toBeUndefined()
    expect(campoDoLog(1)?.["run.id"]).toBe("r2")
    expect(campoDoLog(2)?.["run.id"]).toBe("r3")
    expect(campoDoLog(3)?.["run.id"]).toBeUndefined()
    expect(exporter.getFinishedSpans()[0]?.attributes["run.id"]).toBe("r3")
  })

  it("run continuado por traceparent recria o portador do run.id", async () => {
    const telemetria = createOtelTelemetry()
    const traceparent = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"

    await telemetria.span(
      "run",
      { "run.id": "r9" },
      async () => {
        telemetria.log("run_retomado", { "pausa.tipo": "pergunta" })
      },
      { traceparent },
    )

    expect(campoDoLog(0)).toMatchObject({
      "run.id": "r9",
      trace_id: "0af7651916cd43dd8448eb211c80319c",
    })
  })

  it("atribuirAoSpanAtual muda o span ativo e não faz nada fora de span", async () => {
    const telemetria = createOtelTelemetry()

    telemetria.atribuirAoSpanAtual({ "run.caminho": "x" })
    await telemetria.span("run", {}, async () => {
      telemetria.atribuirAoSpanAtual({ "run.caminho": "conversa" })
    })

    expect(exporter.getFinishedSpans()[0]?.attributes["run.caminho"]).toBe("conversa")
  })

  it("exceção que escapa do run falha o span e loga erro_inesperado", async () => {
    const telemetria = createOtelTelemetry()

    await expect(
      telemetria.span("run", { "run.id": "r4" }, async () => {
        throw new Error("texto da pessoa")
      }),
    ).rejects.toThrow()

    expect(exporter.getFinishedSpans()[0]?.attributes["erro.codigo"]).toBe("erro_inesperado")
    expect(campoDoLog(0)).toMatchObject({ "erro.codigo": "erro_inesperado", "run.id": "r4" })
    expect(logExporter.getFinishedLogRecords()[0]?.severityText).toBe("ERROR")
  })

  it("histogramas usam os buckets de config/telemetria", async () => {
    const telemetria = createOtelTelemetry()

    telemetria.histograma("ritu_run_passos", 2, { caminho: "conversa", status: "done" })
    telemetria.histograma("ritu_tool_duracao_ms", 30, { tool: "clima.agora" })
    await leitor.forceFlush()

    const dados = metricExporter
      .getMetrics()
      .flatMap((m) => m.scopeMetrics.flatMap((e) => e.metrics))
    const limites = (nome: string) => {
      const ponto = dados.find((d) => d.descriptor.name === nome)?.dataPoints[0]
      return (ponto?.value as { buckets: { boundaries: number[] } } | undefined)?.buckets.boundaries
    }
    expect(limites("ritu_run_passos")).toEqual([...limitesDoConfig.buckets.ritu_run_passos])
    expect(limites("ritu_tool_duracao_ms")).toEqual([
      ...limitesDoConfig.buckets.ritu_tool_duracao_ms,
    ])
  })
})
