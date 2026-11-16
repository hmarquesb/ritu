import { describe, expect, it } from "vitest"
import { neutralizar, neutralizarProfundo } from "./neutralizar"

describe("neutralizar", () => {
  it("troca < por ‹ e > por ›", () => {
    expect(neutralizar("<a>")).toBe("‹a›")
  })

  it("troca todas as ocorrências e deixa o resto do texto como está", () => {
    expect(neutralizar('oi <b>x</b> & "aspas"')).toBe('oi ‹b›x‹/b› & "aspas"')
  })

  it("devolve o texto igual quando não há colchetes angulares", () => {
    expect(neutralizar("sem nada especial")).toBe("sem nada especial")
  })
})

describe("neutralizarProfundo", () => {
  it("neutraliza strings em objetos aninhados e listas, sem mudar chaves", () => {
    const entrada = { "<k>": "<b>x</b>", lista: ["<i>", { fundo: "<u>" }], n: 3 }
    expect(neutralizarProfundo(entrada)).toEqual({
      "<k>": "‹b›x‹/b›",
      lista: ["‹i›", { fundo: "‹u›" }],
      n: 3,
    })
  })

  it("devolve número, booleano, null e undefined como vieram", () => {
    expect(neutralizarProfundo(7)).toBe(7)
    expect(neutralizarProfundo(true)).toBe(true)
    expect(neutralizarProfundo(null)).toBeNull()
    expect(neutralizarProfundo(undefined)).toBeUndefined()
  })

  it("neutraliza uma string solta", () => {
    expect(neutralizarProfundo("<a>")).toBe("‹a›")
  })

  it("não altera o valor original", () => {
    const original = { a: "<x>" }
    neutralizarProfundo(original)
    expect(original.a).toBe("<x>")
  })
})
