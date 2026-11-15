import { describe, expect, it } from "vitest"
import { climaEmQualidades } from "./qualidades"

describe("climaEmQualidades", () => {
  it("temperatura abaixo de 20 é frio; 20 e 27 são neutros; acima de 27 é quente", () => {
    expect(climaEmQualidades({ temperatura_aparente: 19.9, umidade: 60 }).faixa_temperatura).toBe(
      "frio",
    )
    expect(climaEmQualidades({ temperatura_aparente: 20, umidade: 60 }).faixa_temperatura).toBe(
      "neutro",
    )
    expect(climaEmQualidades({ temperatura_aparente: 27, umidade: 60 }).faixa_temperatura).toBe(
      "neutro",
    )
    expect(climaEmQualidades({ temperatura_aparente: 27.1, umidade: 60 }).faixa_temperatura).toBe(
      "quente",
    )
  })

  it("umidade abaixo de 50 é seco; 50 e 75 são neutros; acima de 75 é úmido com guna oleoso", () => {
    expect(climaEmQualidades({ temperatura_aparente: 24, umidade: 49.9 }).faixa_umidade).toBe(
      "seco",
    )
    expect(climaEmQualidades({ temperatura_aparente: 24, umidade: 50 }).faixa_umidade).toBe(
      "neutro",
    )
    expect(climaEmQualidades({ temperatura_aparente: 24, umidade: 75 }).faixa_umidade).toBe(
      "neutro",
    )
    const umido = climaEmQualidades({ temperatura_aparente: 24, umidade: 75.1 })
    expect(umido.faixa_umidade).toBe("umido")
    expect(umido.gunas).toEqual(["oleoso"])
  })

  it("frio e seco dão frio e seco, nessa ordem", () => {
    expect(climaEmQualidades({ temperatura_aparente: 10, umidade: 30 }).gunas).toEqual([
      "frio",
      "seco",
    ])
  })

  it("frio e úmido dão frio e oleoso", () => {
    expect(climaEmQualidades({ temperatura_aparente: 10, umidade: 90 }).gunas).toEqual([
      "frio",
      "oleoso",
    ])
  })

  it("quente e seco dão quente e seco", () => {
    expect(climaEmQualidades({ temperatura_aparente: 35, umidade: 30 }).gunas).toEqual([
      "quente",
      "seco",
    ])
  })

  it("quente e úmido dão quente e oleoso", () => {
    expect(climaEmQualidades({ temperatura_aparente: 35, umidade: 90 }).gunas).toEqual([
      "quente",
      "oleoso",
    ])
  })

  it("faixa neutra não acrescenta guna", () => {
    expect(climaEmQualidades({ temperatura_aparente: 24, umidade: 60 }).gunas).toEqual([])
  })
})
