export class RituError extends Error {
  readonly code: string

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
