import type { z } from "zod"
import { RituError } from "@/core/errors"

export type ChamadaDeTool = { id: string; nome: string; argumentos: unknown }

export type MensagemDoLoop =
  | { papel: "pessoa"; conteudo: string }
  | { papel: "agente"; texto?: string; chamadas: ChamadaDeTool[] }
  | { papel: "tool"; chamada_id: string; nome: string; resultado: unknown }
  | { papel: "sistema"; conteudo: string } // lembretes do loop

export type PedidoDePasso = {
  instrucoes: string
  mensagens: MensagemDoLoop[]
  tools: { name: string; description: string; input: z.ZodType }[]
  modelo: string
  timeoutMs: number
}

export type ResultadoDePasso = {
  texto?: string
  chamadas: ChamadaDeTool[]
  tokens_entrada: number
  tokens_saida: number
}

export interface AgentRuntime {
  passo(p: PedidoDePasso): Promise<ResultadoDePasso>
}

export type CodigoLlm = "rate_limit" | "timeout" | "indisponivel" | "resposta_invalida"

export class LlmError extends RituError {
  declare readonly code: CodigoLlm

  constructor(code: CodigoLlm, message: string) {
    super(code, message)
    this.name = "LlmError"
  }
}
