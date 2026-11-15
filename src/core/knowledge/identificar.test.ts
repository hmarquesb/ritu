import { describe, expect, it } from "vitest"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { identificarAlimento, normalizar, resolverEvitar } from "./identificar"

const kb = createMiniKnowledge()

describe("normalizar", () => {
  it("minúsculas, sem acento, pontuação trocada por espaço e espaços colapsados", () => {
    expect(normalizar("  Abóbora, Cabotiá! ")).toBe("abobora cabotia")
  })

  it("troca hífen por espaço", () => {
    expect(normalizar("Banana-prata")).toBe("banana prata")
  })
})

describe("identificarAlimento", () => {
  it("casa pelo id com hífen como espaço, sem diferenciar maiúsculas", () => {
    expect(identificarAlimento("BANANA-PRATA", kb)).toEqual({ tipo: "alimento", id: "banana" })
  })

  it("casa pelo nome com acento", () => {
    expect(identificarAlimento("abóbora", kb)).toEqual({ tipo: "alimento", id: "abobora" })
  })

  it("casa pelo sinônimo", () => {
    expect(identificarAlimento("Jerimum", kb)).toEqual({ tipo: "alimento", id: "abobora" })
  })

  it("nome sem casamento vira desconhecido com o nome original", () => {
    expect(identificarAlimento("Pitaia", kb)).toEqual({ tipo: "desconhecido", nome: "Pitaia" })
  })

  it("não faz semelhança aproximada", () => {
    expect(identificarAlimento("bananas", kb)).toEqual({ tipo: "desconhecido", nome: "bananas" })
  })
})

describe("resolverEvitar", () => {
  it("nome de grupo inteiro vira grupo", () => {
    expect(resolverEvitar("camarão", kb)).toEqual({ tipo: "grupo", valor: "frutos_do_mar" })
  })

  it("nome de alimento inteiro ganha do grupo", () => {
    expect(resolverEvitar("leite", kb)).toEqual({ tipo: "alimento", valor: "leite" })
  })

  it("palavra de grupo dentro do texto vira grupo", () => {
    expect(resolverEvitar("queijo", kb)).toEqual({ tipo: "grupo", valor: "leite" })
  })

  it("texto sem casamento vira texto com o original", () => {
    expect(resolverEvitar("pitaia", kb)).toEqual({ tipo: "texto", valor: "pitaia" })
  })
})
