import { AsyncLocalStorage } from "node:async_hooks"
import { randomBytes } from "node:crypto"
import {
  ATRIBUTOS_PERMITIDOS,
  type AtributoPermitido,
  MAX_TEXTO_ATRIBUTO,
  type NomeDeMetrica,
  type NomeDeSpan,
} from "@/core/telemetry/nomes"
import type { Atributos, SpanAtivo, Telemetry } from "@/core/telemetry/ports"

export type SpanRegistrado = {
  nome: NomeDeSpan
  atributos: Atributos
  pai?: number
  trace: string
  falha?: string
}

export type EventoRegistrado = { nome: "pausa"; atributos: Atributos }

export type MetricaRegistrada = {
  tipo: "contador" | "histograma" | "medidor"
  nome: NomeDeMetrica
  valor: number
  rotulos: Atributos
}

export type LogRegistrado = {
  nivel: "info" | "warn" | "error"
  codigo: string
  campos: Atributos
}

export type MemoryTelemetry = Telemetry & {
  spans: SpanRegistrado[]
  eventos: EventoRegistrado[]
  metricas: MetricaRegistrada[]
  logs: LogRegistrado[]
}

type Contexto = { indice: number; trace: string; spanId: string }

const PERMITIDOS: ReadonlySet<string> = new Set<AtributoPermitido>(ATRIBUTOS_PERMITIDOS)

// Trava de privacidade do fake: atributo fora da lista ou texto longo demais falha no teste.
function validar(atributos: Atributos = {}): void {
  for (const [chave, valor] of Object.entries(atributos)) {
    if (!PERMITIDOS.has(chave)) throw new Error(`atributo_proibido: ${chave}`)
    if (typeof valor === "string" && valor.length > MAX_TEXTO_ATRIBUTO) {
      throw new Error(`atributo_proibido: ${chave}`)
    }
  }
}

const hex = (bytes: number) => randomBytes(bytes).toString("hex")

function traceDe(traceparent: string | undefined, pai: Contexto | undefined): string {
  if (traceparent) return traceparent.split("-")[1] ?? hex(16)
  return pai?.trace ?? hex(16)
}

export function createMemoryTelemetry(): MemoryTelemetry {
  const spans: SpanRegistrado[] = []
  const eventos: EventoRegistrado[] = []
  const metricas: MetricaRegistrada[] = []
  const logs: LogRegistrado[] = []
  const contexto = new AsyncLocalStorage<Contexto>()

  const metrica =
    (tipo: MetricaRegistrada["tipo"]) =>
    (nome: NomeDeMetrica, valor: number, rotulos: Atributos = {}) => {
      validar(rotulos)
      metricas.push({ tipo, nome, valor, rotulos })
    }

  return {
    async span<T>(
      nome: NomeDeSpan,
      atributos: Atributos,
      fn: (s: SpanAtivo) => Promise<T>,
      opts?: { traceparent?: string },
    ): Promise<T> {
      validar(atributos)
      const pai = contexto.getStore()
      const registro: SpanRegistrado = {
        nome,
        atributos: { ...atributos },
        trace: traceDe(opts?.traceparent, pai),
      }
      if (pai) registro.pai = pai.indice
      const indice = spans.push(registro) - 1

      const ativo: SpanAtivo = {
        atribuir(a) {
          validar(a)
          Object.assign(registro.atributos, a)
        },
        falhar(codigo) {
          registro.falha = codigo
        },
      }

      try {
        return await contexto.run({ indice, trace: registro.trace, spanId: hex(8) }, () =>
          fn(ativo),
        )
      } catch (erro) {
        registro.falha ??= "erro"
        throw erro
      }
    },

    evento(nome, atributos = {}) {
      validar(atributos)
      eventos.push({ nome, atributos })
    },

    contador(nome, rotulos = {}, valor = 1) {
      validar(rotulos)
      metricas.push({ tipo: "contador", nome, valor, rotulos })
    },

    histograma: metrica("histograma"),
    medidor: metrica("medidor"),

    log(nivel, codigo, campos = {}) {
      validar(campos)
      logs.push({ nivel, codigo, campos })
    },

    traceparentAtual() {
      const atual = contexto.getStore()
      return atual ? `00-${atual.trace}-${atual.spanId}-01` : undefined
    },

    async encerrar() {},

    spans,
    eventos,
    metricas,
    logs,
  }
}
