import { describe, expect, it } from "vitest"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { mensagemRecebidaSchema, textoDaMensagem } from "./texto"

const kb = createMiniKnowledge()

describe("textoDaMensagem", () => {
  it("monta só os atalhos com emoji, rótulo e separador ' · '", () => {
    const texto = textoDaMensagem({ atalhos: ["com_frio", "agitada"] }, kb)
    expect(texto).toBe("🥶 com frio · 🌪️ agitada")
  })

  it("devolve só o texto quando não há atalhos", () => {
    expect(textoDaMensagem({ texto: "estou cansada", atalhos: [] }, kb)).toBe("estou cansada")
  })

  it("junta atalhos e texto com uma quebra de linha", () => {
    const texto = textoDaMensagem({ texto: "hoje cedo", atalhos: ["com_frio"] }, kb)
    expect(texto).toBe("🥶 com frio\nhoje cedo")
  })

  it("não reinterpreta $& nem chaves vindas da pessoa", () => {
    const texto = textoDaMensagem({ texto: "$& {itens} {titulo}", atalhos: [] }, kb)
    expect(texto).toBe("$& {itens} {titulo}")
  })

  it("aceita mensagem sem texto e sem atalhos", () => {
    expect(textoDaMensagem({ atalhos: [] }, kb)).toBe("")
  })
})

describe("mensagemRecebidaSchema", () => {
  it("aceita texto opcional e atalhos do vocabulário de estados", () => {
    expect(mensagemRecebidaSchema.parse({ atalhos: ["com_frio"] })).toEqual({
      atalhos: ["com_frio"],
    })
    expect(() => mensagemRecebidaSchema.parse({ atalhos: ["inventado"] })).toThrow()
  })
})
