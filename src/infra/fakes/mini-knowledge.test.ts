import { describe, expect, it } from "vitest"
import { validarBase } from "@/core/knowledge/knowledge-base"
import { createMiniKnowledge, miniDados } from "./mini-knowledge"

const ALIMENTOS_OBRIGATORIOS = [
  "leite",
  "iogurte-natural",
  "manteiga",
  "ghee",
  "oleo-de-gergelim",
  "oleo-de-coco",
  "canela",
  "cardamomo",
  "gengibre",
  "limao",
  "banana",
  "mel",
  "abobora",
  "cenoura",
  "batata-doce",
  "arroz-branco",
]

describe("mini base de conhecimento", () => {
  it("createMiniKnowledge não lança", () => {
    expect(() => createMiniKnowledge()).not.toThrow()
  })

  it("passa na validação sem cobertura mínima", () => {
    expect(validarBase(miniDados, { cobertura: false }).erros).toEqual([])
  })

  it("tem as contagens fixas de alimentos, preparos, práticas e combinações", () => {
    expect(miniDados.alimentos).toHaveLength(16)
    expect(miniDados.preparos).toHaveLength(4)
    expect(miniDados.praticas).toHaveLength(6)
    expect(miniDados.combinacoes).toHaveLength(2)
  })

  it("tem os 16 alimentos obrigatórios", () => {
    const ids = miniDados.alimentos.map((alimento) => alimento.id)
    for (const id of ALIMENTOS_OBRIGATORIOS) expect(ids).toContain(id)
  })

  it("expõe as linhas pela chave tabela:id", () => {
    const kb = createMiniKnowledge()
    expect(kb.linha("praticas:oleo-pes-gergelim")).toBeDefined()
  })
})
