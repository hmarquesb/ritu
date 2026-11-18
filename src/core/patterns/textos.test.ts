import { describe, expect, it } from "vitest"
import {
  chaveDeAjuda,
  chaveDeJuntos,
  fraseDeAjuda,
  fraseDeAjudaCha,
  fraseDeJuntos,
  lerChave,
} from "./textos"

const CHA = { tipo: "pratica", id: "cha-gengibre-canela" } as const

describe("chaves de padrão", () => {
  it("monta a chave de 'o que ajuda' com os estados na ordem de ESTADOS", () => {
    expect(chaveDeAjuda(["com_frio", "agitada"], CHA)).toBe(
      "com_frio+agitada|pratica:cha-gengibre-canela",
    )
  })

  it("ordena os estados em chaveDeAjuda (entrada fora de ordem dá a mesma chave)", () => {
    expect(chaveDeAjuda(["agitada", "com_frio"], CHA)).toBe(
      chaveDeAjuda(["com_frio", "agitada"], CHA),
    )
  })

  it("monta a chave de 'estados que andam juntos'", () => {
    expect(chaveDeJuntos("pesada", "sem_energia")).toBe("pesada>sem_energia")
  })

  it("lerChave lê de volta o que chaveDeAjuda monta", () => {
    const chave = chaveDeAjuda(["com_frio", "agitada"], CHA)
    expect(lerChave("ajuda_em_estado", chave)).toEqual({
      estados: ["com_frio", "agitada"],
      item: { tipo: "pratica", id: "cha-gengibre-canela" },
    })
  })

  it("lerChave lê de volta o que chaveDeJuntos monta", () => {
    expect(lerChave("estados_juntos", chaveDeJuntos("pesada", "sem_energia"))).toEqual({
      estados: ["pesada", "sem_energia"],
    })
  })

  it("lê um item do tipo preparo", () => {
    expect(lerChave("ajuda_em_estado", "seca|preparo:sopa-de-lentilha")).toEqual({
      estados: ["seca"],
      item: { tipo: "preparo", id: "sopa-de-lentilha" },
    })
  })

  it.each([
    ["ajuda_em_estado", "com_frio"],
    ["ajuda_em_estado", "com_frio|pratica"],
    ["ajuda_em_estado", "com_frio|pratica:"],
    ["ajuda_em_estado", "com_frio|preparo:"],
    ["ajuda_em_estado", "com_frio|outro:x"],
    ["ajuda_em_estado", "com_frio+nada|pratica:x"],
    ["ajuda_em_estado", "com_frio+com_frio|pratica:x"],
    ["ajuda_em_estado", "com_frio+agitada+pesada|pratica:x"],
    ["ajuda_em_estado", "|pratica:x"],
    ["ajuda_em_estado", "pesada>sem_energia"],
    ["ajuda_em_estado", ""],
    ["estados_juntos", "pesada"],
    ["estados_juntos", "pesada>"],
    ["estados_juntos", "pesada>nada"],
    ["estados_juntos", "pesada>pesada"],
    ["estados_juntos", "com_frio+agitada|pratica:x"],
    ["estados_juntos", ""],
  ] as const)("chave malformada devolve undefined: %s %s", (tipo, chave) => {
    expect(lerChave(tipo, chave)).toBeUndefined()
  })
})

describe("padrão de chá", () => {
  it("monta e lê a chave com_frio+agitada|cha", () => {
    const chave = chaveDeAjuda(["agitada", "com_frio"], { tipo: "cha" })
    expect(chave).toBe("com_frio+agitada|cha")
    expect(lerChave("ajuda_em_estado", chave)).toEqual({
      estados: ["com_frio", "agitada"],
      item: { tipo: "cha" },
    })
  })

  it("monta a frase do chá", () => {
    expect(fraseDeAjudaCha(["com_frio", "agitada"])).toBe(
      "Quando você está com frio e agitada, um chá costuma te ajudar.",
    )
  })
})

describe("frases de padrão", () => {
  it("monta a frase de 'o que ajuda' com dois estados", () => {
    expect(fraseDeAjuda(["com_frio", "agitada"], "chá de gengibre com canela")).toBe(
      "Quando você está com frio e agitada, chá de gengibre com canela costuma te ajudar.",
    )
  })

  it("põe os estados na ordem de ESTADOS na frase", () => {
    expect(fraseDeAjuda(["agitada", "com_frio"], "chá de gengibre com canela")).toBe(
      "Quando você está com frio e agitada, chá de gengibre com canela costuma te ajudar.",
    )
  })

  it("monta a frase de 'estados que andam juntos'", () => {
    expect(fraseDeJuntos("pesada", "sem_energia")).toBe(
      "Quando você está pesada, costuma estar também sem energia.",
    )
  })

  it("monta a frase com um estado só", () => {
    expect(fraseDeAjuda(["pesada"], "chá de gengibre")).toBe(
      "Quando você está pesada, chá de gengibre costuma te ajudar.",
    )
  })

  it("tira o artigo do começo do título e põe a primeira letra minúscula", () => {
    expect(fraseDeAjuda(["pesada"], "O chá de gengibre")).toBe(
      "Quando você está pesada, chá de gengibre costuma te ajudar.",
    )
  })

  it("tira também 'uma' e 'os' do começo do título", () => {
    expect(fraseDeAjuda(["seca"], "Uma sopa morna")).toBe(
      "Quando você está seca, sopa morna costuma te ajudar.",
    )
    expect(fraseDeAjuda(["seca"], "Os grãos cozidos")).toBe(
      "Quando você está seca, grãos cozidos costuma te ajudar.",
    )
  })

  it("mantém $& do título como texto literal", () => {
    expect(fraseDeAjuda(["seca"], "chá $& mel")).toBe(
      "Quando você está seca, chá $& mel costuma te ajudar.",
    )
  })
})
