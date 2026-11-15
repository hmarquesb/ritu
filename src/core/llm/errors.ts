import { RituError } from "@/core/errors"

export type CodigoLlm = "rate_limit" | "timeout" | "indisponivel" | "resposta_invalida"

export class LlmError extends RituError {
  declare readonly code: CodigoLlm

  constructor(code: CodigoLlm, message: string) {
    super(code, message)
    this.name = "LlmError"
  }
}
