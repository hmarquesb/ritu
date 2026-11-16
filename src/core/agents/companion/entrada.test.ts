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

  it("aceita os campos vindos da mensagem e recusa restrição fora do vocabulário", () => {
    const completa = {
      ...minima,
      casa_da_mensagem: { tem: ["abobora"], acabou: [] },
      retorno: { resultado: "ajudou", titulo: "Chá", registrado: false },
      fato_de_rotina: "janto tarde",
      nao_come_da_mensagem: [{ alimento_id: "cenoura", nome: "cenoura" }, { nome: "coentro" }],
      restricoes_da_mensagem: ["vegana"],
    }
    expect(entradaDoAcompanhanteSchema.safeParse(completa).success).toBe(true)
    expect(
      entradaDoAcompanhanteSchema.safeParse({ ...minima, restricoes_da_mensagem: ["xis"] }).success,
    ).toBe(false)
  })

  it("aceita gosta_da_mensagem como lista de ids e recusa outro formato", () => {
    const ok = entradaDoAcompanhanteSchema.safeParse({ ...minima, gosta_da_mensagem: ["gengibre"] })
    expect(ok.success).toBe(true)
    expect(ok.success && ok.data.gosta_da_mensagem).toEqual(["gengibre"])
    expect(
      entradaDoAcompanhanteSchema.safeParse({ ...minima, gosta_da_mensagem: [{ id: "x" }] })
        .success,
    ).toBe(false)
  })
})
