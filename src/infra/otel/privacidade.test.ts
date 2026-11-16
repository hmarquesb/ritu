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
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"
import type { PedidoDePasso } from "@/core/runs/agent-runtime"
import { LOGS, METRICAS, SPANS } from "@/core/telemetry/nomes"
import { createMastraRuntime } from "@/infra/mastra/runtime"
import { montarCenario, rodarCenario } from "../../../test/fixtures/cenarios"
import { rotinaResumida } from "../../../test/fixtures/cenarios/rotina-resumida"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"
import { createOtelTelemetry } from "./telemetry"

const CANARIOS = ["zibelina", "quarzo7"]
const FORMA = /^[a-z0-9][a-z0-9_.:,-]{0,63}$/

const exporter = new InMemorySpanExporter()
const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] })
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
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable())
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

type Valor = unknown
function conferirTexto(origem: string, chave: string, valor: Valor): void {
  if (typeof valor !== "string") return
  const onde = `${origem} ${chave}`
  expect(valor, onde).toMatch(FORMA)
  for (const c of CANARIOS) expect(valor.toLowerCase(), onde).not.toContain(c)
}

function conferirAtributos(origem: string, atributos: Record<string, Valor> | undefined): void {
  for (const [chave, valor] of Object.entries(atributos ?? {})) {
    for (const c of CANARIOS) expect(chave.toLowerCase(), origem).not.toContain(c)
    conferirTexto(origem, chave, valor)
  }
}

async function conferirExportado(): Promise<void> {
  await leitor.forceFlush()
  for (const span of exporter.getFinishedSpans()) {
    expect(Object.keys(SPANS), `span ${span.name}`).toContain(span.name)
    conferirAtributos(`span ${span.name}`, span.attributes)
    for (const e of span.events) conferirAtributos(`evento ${e.name}`, e.attributes)
  }
  const nomesDeMetrica = new Set<string>()
  for (const rm of metricExporter.getMetrics()) {
    for (const sm of rm.scopeMetrics) {
      for (const m of sm.metrics) {
        const nome = m.descriptor.name
        nomesDeMetrica.add(nome)
        expect(Object.keys(METRICAS), `métrica ${nome}`).toContain(nome)
        const declarados = [...METRICAS[nome as keyof typeof METRICAS].rotulos].sort()
        for (const ponto of m.dataPoints) {
          const rotulos = ponto.attributes as Record<string, Valor>
          expect(Object.keys(rotulos).sort(), `rótulos de ${nome}`).toEqual(declarados)
          conferirAtributos(`métrica ${nome}`, rotulos)
        }
      }
    }
  }
  for (const r of logExporter.getFinishedLogRecords()) {
    expect(Object.keys(LOGS), "log").toContain(String(r.body))
    conferirAtributos(`log ${String(r.body)}`, r.attributes as Record<string, Valor>)
  }
}

function cenarioComCanarios(): CenarioDeConversa {
  return {
    ...rotinaResumida,
    perfil: {
      ...rotinaResumida.perfil,
      cidade: { nome: "Quarzo7 do Sul", lat: -22.91, lon: -43.21, fuso: "America/Sao_Paulo" },
      evitar_sempre: [{ tipo: "texto", valor: "zibelina" }],
    },
    rotina: [
      { texto: "você almoça fora, sempre com quarzo7", diasAtras: 12 },
      { texto: "você acorda às 5 h às terças", diasAtras: 5 },
    ],
    mensagem: {
      texto: "voltei a almoçar em casa, zibelina e quarzo7, o que faço hoje?",
      atalhos: [],
    },
  } as CenarioDeConversa
}

describe("privacidade pelo adaptador OTel de verdade", () => {
  it("um cenário completo exporta só nomes da lista e nenhum canário", async () => {
    exporter.reset()
    logExporter.reset()
    metricExporter.reset()
    const c = cenarioComCanarios()
    const { contaId, deps } = await montarCenario(c, { telemetria: createOtelTelemetry() })
    await deps.stores.pantry.registrar(contaId, [{ nome_livre: "zibelina" }], "conversa")
    await rodarCenario(deps, contaId, c)

    expect(exporter.getFinishedSpans().length).toBeGreaterThan(0)
    await conferirExportado()
  })

  it("uma chamada pelo runtime da Mastra não exporta canário nem span fora da lista", async () => {
    exporter.reset()
    logExporter.reset()
    metricExporter.reset()
    const modelo = {
      specificationVersion: "v2" as const,
      provider: "falso",
      modelId: "falso-1",
      supportedUrls: {},
      async doGenerate() {
        return {
          content: [{ type: "text", text: "Vou te ajudar com zibelina quarzo7." }],
          finishReason: "stop",
          usage: { inputTokens: 12, outputTokens: 5, totalTokens: 17 },
          warnings: [],
        }
      },
      async doStream() {
        throw new Error("doStream não é usado")
      },
    }
    const runtime = createMastraRuntime({ apiKey: () => "chave", modeloDe: () => modelo as never })
    const pedido: PedidoDePasso = {
      instrucoes: "Você é o Ritu.",
      mensagens: [{ papel: "pessoa", conteudo: "zibelina quarzo7" }],
      tools: [{ name: "hora_atual", description: "Hora atual", input: z.object({}) }],
      modelo: "falso/falso-1",
      timeoutMs: 5000,
    }
    const telemetria = createOtelTelemetry()
    await telemetria.span("run", { "run.id": "r1" }, async () => {
      await runtime.passo(pedido)
    })

    const nomes = exporter.getFinishedSpans().map((s) => s.name)
    expect(nomes).toContain("run")
    await conferirExportado()
  })
})
