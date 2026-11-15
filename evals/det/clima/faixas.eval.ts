import { describe, expect, it } from "vitest"
import { climaEmQualidades } from "@/core/weather/qualidades"

function qualidades(temperatura_aparente: number, umidade: number) {
  return climaEmQualidades({ temperatura_aparente, umidade })
}

describe("faixas de temperatura aparente", () => {
  it.each([
    [19.9, "frio"],
    [20, "neutro"],
    [27, "neutro"],
    [27.1, "quente"],
  ] as const)("%s °C é %s", (temperatura, faixa) => {
    expect(qualidades(temperatura, 60).faixa_temperatura).toBe(faixa)
  })
})

describe("faixas de umidade", () => {
  it.each([
    [49.9, "seco"],
    [50, "neutro"],
    [75, "neutro"],
    [75.1, "umido"],
  ] as const)("%s %% é %s", (umidade, faixa) => {
    expect(qualidades(24, umidade).faixa_umidade).toBe(faixa)
  })
})

describe("combinações de temperatura e umidade em gunas", () => {
  it("frio e seco vira frio e seco", () => {
    expect(qualidades(15, 30).gunas).toEqual(["frio", "seco"])
  })

  it("frio e úmido vira frio e oleoso", () => {
    expect(qualidades(15, 90).gunas).toEqual(["frio", "oleoso"])
  })

  it("quente e seco vira quente e seco", () => {
    expect(qualidades(32, 30).gunas).toEqual(["quente", "seco"])
  })

  it("quente e úmido vira quente e oleoso", () => {
    expect(qualidades(32, 90).gunas).toEqual(["quente", "oleoso"])
  })

  it("neutro não acrescenta guna", () => {
    expect(qualidades(24, 60).gunas).toEqual([])
  })
})
