import { readFileSync } from "node:fs"
import { join } from "node:path"
import { type Historico, historicoSchema } from "@/core/evals/historico"

const CAMINHO = join("evals", "resultados", "historico.json")

/** Lê o histórico do eval com LLM a partir da raiz; ausente, ilegível ou inválido vira `undefined`. */
export function lerHistorico(raiz: string = process.cwd()): Historico | undefined {
  try {
    const bruto: unknown = JSON.parse(readFileSync(join(raiz, CAMINHO), "utf8"))
    const lido = historicoSchema.safeParse(bruto)
    return lido.success ? lido.data : undefined
  } catch {
    return undefined
  }
}
