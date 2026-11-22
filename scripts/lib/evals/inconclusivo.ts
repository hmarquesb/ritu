// Classifica um caso do eval com LLM: `acertou`, `falhou` ou `inconclusivo`, com o motivo. Puro: recebe o que o
// runner colheu do run (etapas, métricas de erro do LLM, erro e Juiz) e não lê banco nem telemetria.
import type { Colhido, EstadoDoCaso, MotivoInconclusivo } from "./resultado"

export type Classificacao = { estado: EstadoDoCaso; inconclusivo?: MotivoInconclusivo }

export type EntradaDaClassificacao = {
  erro?: string
  etapas: Colhido["etapas"]
  houveCotaOu429: boolean
  fim?: string
  juiz?: "aprovado" | "reprovado" | "indisponivel"
  validouOk: boolean
  chamadasDeDecisao: number
}

const BANCO = /AggregateError|ECONNREFUSED/
const TIMEOUT = /timeout|timed out|ETIMEDOUT/i

function motivoDe(p: EntradaDaClassificacao): MotivoInconclusivo | undefined {
  if (p.houveCotaOu429 || p.erro?.includes("rate_limit")) return "cota"
  if (p.validouOk && p.juiz === "indisponivel") return "juiz_indisponivel"
  if (p.fim === "indisponivel") return "cota"
  if (p.erro === undefined) return undefined
  if (BANCO.test(p.erro)) return "banco"
  if (TIMEOUT.test(p.erro) && p.chamadasDeDecisao === 0) return "timeout_sem_decisao"
  if (p.etapas.length === 0) return "sem_etapas"
  return undefined
}

/** Sem motivo de inconclusivo, o caso é `falhou` até `fecharEstado` conferir as checagens. */
export function classificarCaso(p: EntradaDaClassificacao): Classificacao {
  const motivo = motivoDe(p)
  return motivo === undefined
    ? { estado: "falhou" }
    : { estado: "inconclusivo", inconclusivo: motivo }
}

/** Fecha o estado com o acerto das checagens. Inconclusivo nunca vira `acertou`. */
export function fecharEstado(acertou: boolean, c: Classificacao): Classificacao {
  if (c.estado === "inconclusivo") return c
  return { estado: acertou ? "acertou" : "falhou" }
}

export type MetricaVista = { nome: string; rotulos: Record<string, unknown> }

/**
 * Sinais de erro do LLM colhidos das métricas do caso: `houveCotaOu429` quando alguma chamada voltou com
 * `rate_limit`; `fim` = `indisponivel` quando o run falhou e algum erro foi `indisponivel`.
 */
export function sinaisDeErroDoLlm(
  metricas: MetricaVista[],
  statusDoRun?: string,
): { houveCotaOu429: boolean; fim?: "indisponivel" } {
  const codigos = metricas
    .filter((m) => m.nome === "ritu_llm_erros_total")
    .map((m) => String(m.rotulos.codigo))
  const indisponivel = statusDoRun === "failed" && codigos.includes("indisponivel")
  return {
    houveCotaOu429: codigos.includes("rate_limit"),
    fim: indisponivel ? "indisponivel" : undefined,
  }
}
