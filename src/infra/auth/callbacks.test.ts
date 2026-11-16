import { describe, expect, it } from "vitest"
import { montarSessao, montarToken } from "./callbacks"

describe("montarToken", () => {
  it("no login grava contaId e tipo e apaga name, email e picture", () => {
    const token = montarToken(
      { name: "Ana", email: "ana@x.com", picture: "http://foto", sub: "g1" },
      { contaId: "c1", tipo: "google" },
    )
    expect(token.contaId).toBe("c1")
    expect(token.tipo).toBe("google")
    expect(token).not.toHaveProperty("name")
    expect(token).not.toHaveProperty("email")
    expect(token).not.toHaveProperty("picture")
  })

  it("sem login novo mantém o token", () => {
    const token = montarToken({ contaId: "c1", tipo: "demo" }, undefined)
    expect(token).toEqual({ contaId: "c1", tipo: "demo" })
  })
})

describe("montarSessao", () => {
  it("expõe só contaId e tipo", () => {
    const sessao = montarSessao(
      { expires: "2030-01-01" },
      { contaId: "c1", tipo: "demo", sub: "g1" },
    )
    expect(sessao).toEqual({ contaId: "c1", tipo: "demo", expires: "2030-01-01" })
  })
})
