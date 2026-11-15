import { describe, expect, it } from "vitest"
import { neutralizar } from "./neutralizar"

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
