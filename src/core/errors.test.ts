import { describe, expect, it } from "vitest"
import { MissingEnvError, RituError } from "./errors"

describe("marca de RituError", () => {
  it("a instância e as subclasses levam a marca global", () => {
    const marca = Symbol.for("ritu.error")
    expect((new RituError("x", "m") as unknown as Record<symbol, unknown>)[marca]).toBe(true)
    expect((new MissingEnvError("A") as unknown as Record<symbol, unknown>)[marca]).toBe(true)
  })
})

describe("MissingEnvError", () => {
  it("é um RituError com código env_ausente", () => {
    const erro = new MissingEnvError("GEMINI_API_KEY")

    expect(erro).toBeInstanceOf(RituError)
    expect(erro.code).toBe("env_ausente")
  })

  it("monta a mensagem com o nome da variável", () => {
    const erro = new MissingEnvError("GEMINI_API_KEY")

    expect(erro.message).toBe("Defina GEMINI_API_KEY no .env.local")
  })

  it("usa o nome da própria classe", () => {
    expect(new MissingEnvError("AUTH_SECRET").name).toBe("MissingEnvError")
  })
})
