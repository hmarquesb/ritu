import { describe, expect, it } from "vitest"
import type { FiltroPessoa } from "@/core/knowledge/filtros"
import { filtroVazio } from "@/core/knowledge/filtros"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { chaveDeAjuda, chaveDeJuntos } from "./textos"
import { padraoVale } from "./vale"

const kb = createMiniKnowledge()
const CHA = {
  tipo: "ajuda_em_estado" as const,
  chave: chaveDeAjuda(["com_frio", "agitada"], { tipo: "pratica", id: "cha-gengibre" }),
}

function com(parcial: Partial<FiltroPessoa>): FiltroPessoa {
  return { ...filtroVazio, ...parcial }
}

describe("padraoVale", () => {
  it("estados_juntos sempre vale", () => {
    expect(
      padraoVale(
        { tipo: "estados_juntos", chave: chaveDeJuntos("pesada", "sem_energia") },
        filtroVazio,
        kb,
      ),
    ).toBe(true)
  })

  it("ajuda_em_estado do chá vale com filtro vazio", () => {
    expect(padraoVale(CHA, filtroVazio, kb)).toBe(true)
  })

  it("com gengibre em evitar sempre, o chá não vale", () => {
    const filtro = com({ evitar: [{ tipo: "alimento", valor: "gengibre" }] })
    expect(padraoVale(CHA, filtro, kb)).toBe(false)
  })

  it("com gengibre em não como, o chá não vale", () => {
    expect(padraoVale(CHA, com({ nao_come: ["gengibre"] }), kb)).toBe(false)
  })

  it("com gengibre em não gosto, o chá não vale", () => {
    expect(padraoVale(CHA, com({ nao_gosta: ["gengibre"] }), kb)).toBe(false)
  })

  it("restrição que barra o item (nunca_sugerir_se) não vale", () => {
    const chave = chaveDeAjuda(["com_frio"], { tipo: "pratica", id: "cha-gengibre-limao-mel" })
    expect(padraoVale({ tipo: "ajuda_em_estado", chave }, filtroVazio, kb)).toBe(true)
    expect(
      padraoVale({ tipo: "ajuda_em_estado", chave }, com({ restricoes: ["vegana"] }), kb),
    ).toBe(false)
  })

  it("item que não existe na base não vale", () => {
    const chave = chaveDeAjuda(["com_frio"], { tipo: "pratica", id: "nao-existe" })
    expect(padraoVale({ tipo: "ajuda_em_estado", chave }, filtroVazio, kb)).toBe(false)
  })

  it("preparo que não existe na base não vale", () => {
    const chave = chaveDeAjuda(["seca"], { tipo: "preparo", id: "nao-existe" })
    expect(padraoVale({ tipo: "ajuda_em_estado", chave }, filtroVazio, kb)).toBe(false)
  })

  it.each([
    ["ajuda_em_estado", "com_frio"],
    ["ajuda_em_estado", "com_frio|pratica:"],
    ["ajuda_em_estado", "com_frio|outro:cha-gengibre"],
    ["ajuda_em_estado", "nada|pratica:cha-gengibre"],
    ["estados_juntos", "pesada"],
    ["estados_juntos", "pesada>pesada"],
  ] as const)("chave malformada não vale: %s %s", (tipo, chave) => {
    expect(padraoVale({ tipo, chave }, filtroVazio, kb)).toBe(false)
  })
})
