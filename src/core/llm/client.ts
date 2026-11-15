import type { z } from "zod"

export interface LlmClient {
  /** Lança LlmError. */
  gerar<T>(p: {
    modelo: string
    instrucoes: string
    entrada: string
    schema: z.ZodType<T>
    timeoutMs?: number
  }): Promise<{ dado: T; tokens: { entrada: number; saida: number } }>
}
