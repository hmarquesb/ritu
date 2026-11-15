import type { LlmError } from "@/core/runs/agent-runtime"

export interface FornecedorDeModelo {
  /** null: sem modelo disponível. */
  proximo(): Promise<{ modelo: string; troca?: { de: string; motivo: "cota" | "429" } } | null>
  usou(modelo: string, tokens: { entrada: number; saida: number }): Promise<void>
  falhou(modelo: string, erro: LlmError): Promise<void>
}
