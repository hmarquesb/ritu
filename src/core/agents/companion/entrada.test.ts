import { describe, expect, it } from "vitest"
import { entradaDoAcompanhanteSchema } from "./entrada"

const minima = { intencoes: ["momento"], estados: [], evitar_da_mensagem: [] }

describe("entradaDoAcompanhanteSchema", () => {
  it("aceita a entrada mínima válida", () => {
    expect(entradaDoAcompanhanteSchema.safeParse(minima).success).toBe(true)
  })

  it("aceita texto com até 1000 caracteres e incômodo com variante", () => {
    const entrada = {
      ...minima,
      texto: "a".repeat(1000),
      incomodo: { id: "gases", variante: "depois do almoço" },
    }
    expect(entradaDoAcompanhanteSchema.safeParse(entrada).success).toBe(true)
  })

  it("recusa intencoes vazio", () => {
    expect(entradaDoAcompanhanteSchema.safeParse({ ...minima, intencoes: [] }).success).toBe(false)
  })

  it("recusa texto com 1001 caracteres", () => {
    expect(
      entradaDoAcompanhanteSchema.safeParse({ ...minima, texto: "a".repeat(1001) }).success,
    ).toBe(false)
  })

  it("recusa estado fora do vocabulário", () => {
    expect(
      entradaDoAcompanhanteSchema.safeParse({ ...minima, estados: ["estado-inventado"] }).success,
    ).toBe(false)
  })
})
