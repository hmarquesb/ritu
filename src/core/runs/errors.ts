import { RituError } from "@/core/errors"

export class RunAbertoError extends RituError {
  constructor() {
    super("run_aberto", "Já existe uma conversa em andamento")
    this.name = "RunAbertoError"
  }
}
