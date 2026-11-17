// Marca global: `Symbol.for` é o mesmo em toda cópia do módulo (o Next carrega cópias separadas),
// então vale onde `instanceof` falha.
export const MARCA_RITU = Symbol.for("ritu.error")

export class RituError extends Error {
  readonly code: string
  readonly [MARCA_RITU] = true

  constructor(code: string, message: string) {
    super(message)
    this.name = "RituError"
    this.code = code
  }
}

export class MissingEnvError extends RituError {
  constructor(variable: string) {
    super("env_ausente", `Defina ${variable} no .env.local`)
    this.name = "MissingEnvError"
  }
}
