import { RituError } from "@/core/errors"

export type CodigoDeLimite = "limite_mensagens" | "limite_demo" | "limite_ip" | "limite_toques"

const MENSAGENS: Record<CodigoDeLimite, string> = {
  limite_mensagens: "Você chegou ao limite de mensagens de hoje",
  limite_demo: "As mensagens da demonstração acabaram",
  limite_ip: "As mensagens desta conexão acabaram hoje",
  limite_toques: "Muitos toques seguidos ou limite de toques de hoje",
}

export class LimiteError extends RituError {
  readonly retryAfterS: number

  constructor(code: CodigoDeLimite, retryAfterS: number) {
    super(code, MENSAGENS[code])
    this.name = "LimiteError"
    this.retryAfterS = retryAfterS
  }
}
