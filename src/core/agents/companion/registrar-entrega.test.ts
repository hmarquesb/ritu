import { describe, expect, it } from "vitest"
import { sugestaoRegistradaSchema } from "@/core/memory-schemas"
import { idEfetivo, sugestaoRegistrada } from "./registrar-entrega"
import type { SugestaoEntregue } from "./saida"

type Item = SugestaoEntregue["itens"][number]

function item(mudar: Partial<Item> = {}): Item {
  return {
    alimento_id: "gengibre",
    nome: "Gengibre",
    contribui: ["quente"],
    verbos: ["aquece"],
    linha_base: "alimentos:gengibre",
    casa: "confirmado",
    ...mudar,
  }
}

function sugestao(mudar: Partial<SugestaoEntregue> = {}): SugestaoEntregue {
  return {
    tipo: "cha",
    pratica_id: "cha-gengibre",
    titulo: "Chá de gengibre",
    como_fazer: "Ferva.",
    itens: [item()],
    verbos: ["aquece"],
    motivo: "Aquece.",
    linhas_base: ["praticas:cha-gengibre"],
    novidade: false,
    ...mudar,
  }
}

const trocaParaCanela: NonNullable<Item["troca"]> = {
  alimento_id: "canela",
  nome: "Canela",
  contribui: ["quente"],
  verbos: ["aquece"],
  linha_base: "alimentos:canela",
  frase: "Troquei gengibre por canela: ambos aquecem.",
  anteriores: [],
}

describe("idEfetivo", () => {
  it("sem troca, é o alimento do item", () => {
    expect(idEfetivo(item())).toBe("gengibre")
  })

  it("com troca, é o alimento da troca", () => {
    expect(idEfetivo(item({ troca: trocaParaCanela }))).toBe("canela")
  })
})

describe("sugestaoRegistrada", () => {
  it("um chá leva pratica_id, sem preparo_id, e os alimentos do item", () => {
    const r = sugestaoRegistrada(sugestao())
    expect(r).toEqual({
      tipo: "cha",
      pratica_id: "cha-gengibre",
      alimentos: ["gengibre"],
      titulo: "Chá de gengibre",
    })
    expect(r).not.toHaveProperty("preparo_id")
    expect(sugestaoRegistradaSchema.safeParse(r).success).toBe(true)
  })

  it("uma refeição com um item trocado registra o alimento efetivo, na ordem dos itens", () => {
    const r = sugestaoRegistrada(
      sugestao({
        tipo: "refeicao",
        pratica_id: undefined,
        preparo_id: "leite-morno-com-especiaria",
        titulo: "Leite morno com canela",
        itens: [
          item({ alimento_id: "leite", nome: "Leite" }),
          item({ alimento_id: "mel", nome: "Mel", troca: trocaParaCanela }),
        ],
      }),
    )
    expect(r).toEqual({
      tipo: "refeicao",
      preparo_id: "leite-morno-com-especiaria",
      alimentos: ["leite", "canela"],
      titulo: "Leite morno com canela",
    })
    expect(r.alimentos).not.toContain("mel")
    expect(r).not.toHaveProperty("pratica_id")
    expect(sugestaoRegistradaSchema.safeParse(r).success).toBe(true)
  })

  it("uma prática sem itens registra alimentos vazio", () => {
    const r = sugestaoRegistrada(sugestao({ itens: [] }))
    expect(r.alimentos).toEqual([])
    expect(sugestaoRegistradaSchema.safeParse(r).success).toBe(true)
  })
})
