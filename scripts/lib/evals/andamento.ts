// Andamento da rodada do eval com LLM: o que já foi feito, salvo depois de cada caso, para retomar sem repetir.
import { createHash } from "node:crypto"
import { z } from "zod"
import type { llmCotas } from "../../../config/llm-cotas"
import type { ResultadoDoCaso } from "./resultado"

export type Andamento = {
  versao: 1
  checkpoint: string
  assinatura: string
  iniciada_em: string
  resultados: ResultadoDoCaso[]
}

// Confere só a forma: o resto do resultado é o tipo de `resultado.ts`, sem reescrever aqui.
const formaDoResultado = z
  .object({
    id: z.string(),
    tipo: z.string(),
    checagens: z.array(z.object({}).passthrough()),
    acertou: z.boolean(),
  })
  .passthrough()

const resultadoSchema = z.custom<ResultadoDoCaso>(
  (valor) => formaDoResultado.safeParse(valor).success,
)

export const andamentoSchema = z.object({
  versao: z.literal(1),
  checkpoint: z.string(),
  assinatura: z.string(),
  iniciada_em: z.string(),
  resultados: z.array(resultadoSchema),
})

/** Hash das entradas que mudam o resultado: ids, versões dos prompts (chaves ordenadas) e modelos de cada papel. */
export function assinar(p: {
  ids: string[]
  prompts: Record<string, string>
  papeis: typeof llmCotas.papeis
}): string {
  const prompts = Object.fromEntries(
    Object.keys(p.prompts)
      .sort()
      .map((chave) => [chave, p.prompts[chave]]),
  )
  const entrada = JSON.stringify({ ids: p.ids, prompts, papeis: p.papeis })
  return createHash("sha256").update(entrada).digest("hex")
}

/** JSON inválido ou fora do schema (inclusive `versao` diferente de 1): o andamento não serve. */
export function lerAndamento(texto: string): { ok: true; andamento: Andamento } | { ok: false } {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return { ok: false }
  }
  const lido = andamentoSchema.safeParse(bruto)
  return lido.success ? { ok: true, andamento: lido.data } : { ok: false }
}

export const arquivoDoAndamento = (checkpoint: string): string =>
  `evals/local/andamento-${checkpoint}.json`
