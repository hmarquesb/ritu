import { telemetria } from "@config/telemetria"
import {
  type Attributes,
  type Context,
  type Counter,
  context,
  createContextKey,
  type Gauge,
  type Histogram,
  metrics,
  propagation,
  ROOT_CONTEXT,
  type Span,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api"
import { logs, SeverityNumber } from "@opentelemetry/api-logs"
import {
  ATRIBUTOS_PERMITIDOS,
  type CodigoDeLog,
  LOGS,
  MAX_TEXTO_ATRIBUTO,
} from "@/core/telemetry/nomes"
import type { Atributos, SpanAtivo, Telemetry } from "@/core/telemetry/ports"

const NOME_DO_INSTRUMENTO = "ritu"
const PERMITIDOS: ReadonlySet<string> = new Set(ATRIBUTOS_PERMITIDOS)

// Portador mutável do `run.id` do span `run` ativo: o atributo pode chegar depois da abertura.
type PortadorDoRun = { runId?: string }
const CHAVE_DO_RUN = createContextKey("ritu.run")

function portadorAtivo(): PortadorDoRun | undefined {
  return context.active().getValue(CHAVE_DO_RUN) as PortadorDoRun | undefined
}

function lembrarRunId(portador: PortadorDoRun | undefined, atributos: Attributes): void {
  const id = atributos["run.id"]
  if (portador && id !== undefined) portador.runId = String(id)
}

const SEVERIDADE = {
  info: { numero: SeverityNumber.INFO, texto: "INFO" },
  warn: { numero: SeverityNumber.WARN, texto: "WARN" },
  error: { numero: SeverityNumber.ERROR, texto: "ERROR" },
} as const

type Nivel = keyof typeof SEVERIDADE
type Valor = string | number | boolean | undefined

function atributoValido(chave: string, valor: Valor): boolean {
  if (valor === undefined || !PERMITIDOS.has(chave)) return false
  return typeof valor !== "string" || valor.length <= MAX_TEXTO_ATRIBUTO
}

type ComFlush = { forceFlush?: () => Promise<void> }
type Delegavel = { getDelegate?: () => unknown; _getDelegate?: () => unknown }
type LoggerProxy = { _getDelegateLogger?: (nome: string) => unknown }

async function descarregar(provedor: unknown): Promise<void> {
  const proxy = provedor as Delegavel
  const delegado = proxy.getDelegate?.() ?? proxy._getDelegate?.() ?? provedor
  await (delegado as ComFlush).forceFlush?.()
}

// Provedor de logs do Proxy sem delegado: nenhum SDK foi registrado.
function semProvedorDeLogs(): boolean {
  const proxy = logs.getLoggerProvider() as LoggerProxy
  return (
    proxy._getDelegateLogger?.(NOME_DO_INSTRUMENTO) === undefined && "_getDelegateLogger" in proxy
  )
}

export function createOtelTelemetry(): Telemetry {
  const tracer = trace.getTracer(NOME_DO_INSTRUMENTO)
  const medidor = metrics.getMeter(NOME_DO_INSTRUMENTO)
  const contadores = new Map<string, Counter>()
  const histogramas = new Map<string, Histogram>()
  const medidores = new Map<string, Gauge>()

  // Só o que está na lista fechada e cabe em 64 caracteres passa; o resto é descartado com um aviso.
  function filtrar(atributos: Atributos | undefined): Attributes {
    const limpos: Attributes = {}
    for (const [chave, valor] of Object.entries(atributos ?? {})) {
      if (atributoValido(chave, valor)) {
        limpos[chave] = valor
      } else if (valor !== undefined) {
        emitir("atributo_proibido", { "erro.codigo": "atributo_proibido" }, false)
      }
    }
    return limpos
  }

  function emitir(codigo: CodigoDeLog, campos: Atributos | undefined, validar = true) {
    const nivel: Nivel = LOGS[codigo]
    const atributos = validar ? filtrar(campos) : { ...campos }
    const ativo = trace.getActiveSpan()?.spanContext()
    const runId = portadorAtivo()?.runId
    if (runId !== undefined && atributos["run.id"] === undefined) atributos["run.id"] = runId
    if (ativo && atributos.trace_id === undefined) atributos.trace_id = ativo.traceId
    const { numero, texto } = SEVERIDADE[nivel]
    logs.getLogger(NOME_DO_INSTRUMENTO).emit({
      severityNumber: numero,
      severityText: texto,
      body: codigo,
      attributes: atributos,
    })
    // Sem um logger registrado, o log vai para o console em JSON, só com campos permitidos.
    if (semProvedorDeLogs()) console[nivel](JSON.stringify({ nivel, codigo, ...atributos }))
  }

  function envolver(span: Span, portador?: PortadorDoRun): SpanAtivo {
    return {
      atribuir(a) {
        const limpos = filtrar(a)
        span.setAttributes(limpos)
        lembrarRunId(portador, limpos)
      },
      falhar(codigo) {
        span.setAttribute("erro.codigo", codigo)
        span.setStatus({ code: SpanStatusCode.ERROR, message: codigo })
      },
    }
  }

  function contextoPai(traceparent: string | undefined): Context {
    if (!traceparent) return context.active()
    return propagation.extract(ROOT_CONTEXT, { traceparent })
  }

  // O span `run` guarda o portador do `run.id` no contexto, também quando continua por traceparent.
  function contextoDoSpan(
    nome: string,
    limpos: Attributes,
    traceparent: string | undefined,
  ): { ctx: Context; portador?: PortadorDoRun } {
    const ctx = contextoPai(traceparent)
    if (nome !== "run") return { ctx }
    const portador: PortadorDoRun = {}
    lembrarRunId(portador, limpos)
    return { ctx: ctx.setValue(CHAVE_DO_RUN, portador), portador }
  }

  function instrumento<T>(mapa: Map<string, T>, nome: string, criar: () => T): T {
    let item = mapa.get(nome)
    if (!item) {
      item = criar()
      mapa.set(nome, item)
    }
    return item
  }

  function criarHistograma(nome: string): Histogram {
    const limites = (telemetria.buckets as Record<string, readonly number[]>)[nome]
    return medidor.createHistogram(
      nome,
      limites ? { advice: { explicitBucketBoundaries: [...limites] } } : undefined,
    )
  }

  return {
    span(nome, atributos, fn, opts) {
      const limpos = filtrar(atributos)
      const { ctx, portador } = contextoDoSpan(nome, limpos, opts?.traceparent)
      return tracer.startActiveSpan(nome, { attributes: limpos }, ctx, async (span) => {
        const ativo = envolver(span, portador)
        try {
          return await fn(ativo)
        } catch (erro) {
          // Só um código fixo: a mensagem do erro pode carregar texto da pessoa.
          ativo.falhar("erro_inesperado")
          if (nome === "run") emitir("erro_inesperado", { "erro.codigo": "erro_inesperado" })
          throw erro
        } finally {
          span.end()
        }
      })
    },
    evento(nome, atributos) {
      trace.getActiveSpan()?.addEvent(nome, filtrar(atributos))
    },
    contador(nome, rotulos, valor = 1) {
      instrumento(contadores, nome, () => medidor.createCounter(nome)).add(valor, filtrar(rotulos))
    },
    histograma(nome, valor, rotulos) {
      instrumento(histogramas, nome, () => criarHistograma(nome)).record(valor, filtrar(rotulos))
    },
    medidor(nome, valor, rotulos) {
      instrumento(medidores, nome, () => medidor.createGauge(nome)).record(valor, filtrar(rotulos))
    },
    atribuirAoSpanAtual(a) {
      const span = trace.getActiveSpan()
      if (!span) return
      const limpos = filtrar(a)
      span.setAttributes(limpos)
      lembrarRunId(portadorAtivo(), limpos)
    },
    log(codigo, campos) {
      emitir(codigo, campos)
    },
    traceparentAtual() {
      const carrier: Record<string, string> = {}
      propagation.inject(context.active(), carrier)
      return carrier.traceparent
    },
    async encerrar() {
      await Promise.allSettled([
        descarregar(trace.getTracerProvider()),
        descarregar(metrics.getMeterProvider()),
        descarregar(logs.getLoggerProvider()),
      ])
    },
  }
}
