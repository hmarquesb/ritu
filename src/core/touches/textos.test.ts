import { describe, expect, it } from "vitest"
import { textoSemSubstituto, textosDosToques } from "./textos"

describe("textos dos toques", () => {
  it("o modelo de 'sem substituto' tem o marcador {item} com a frase da spec", () => {
    expect(textosDosToques.semSubstituto).toBe(
      "Não achei uma troca para {item} com o que você tem em casa.",
    )
  })

  it("troca o item pelo nome em minúsculas", () => {
    expect(textoSemSubstituto("Gengibre")).toBe(
      "Não achei uma troca para gengibre com o que você tem em casa.",
    )
  })

  it("não reinterpreta o nome: $& sai literal", () => {
    expect(textoSemSubstituto("Sal $& pimenta")).toBe(
      "Não achei uma troca para sal $& pimenta com o que você tem em casa.",
    )
  })
})
