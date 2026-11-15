import { RituError } from "@/core/errors"

export class RunAbertoError extends RituError {
  constructor() {
    super("run_aberto", "Já existe uma conversa em andamento")
    this.name = "RunAbertoError"
  }
}

export class RunNaoContinuavelError extends RituError {
  constructor() {
    super("run_nao_continuavel", "Esta conversa não pode mais ser continuada")
    this.name = "RunNaoContinuavelError"
  }
}
