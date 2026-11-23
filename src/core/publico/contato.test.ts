import { describe, expect, it } from "vitest"
import { contatoDePrivacidade } from "./contato"

describe("contatoDePrivacidade", () => {
  it("devolve o e-mail válido", () => {
    expect(contatoDePrivacidade("privacidade@ritu.dev")).toBe("privacidade@ritu.dev")
  })

  it("apara espaços das pontas", () => {
    expect(contatoDePrivacidade("  privacidade@ritu.dev \n")).toBe("privacidade@ritu.dev")
  })

  it("mantém o e-mail como foi digitado, sem trocar maiúsculas", () => {
    expect(contatoDePrivacidade(" Privacidade@Ritu.dev ")).toBe("Privacidade@Ritu.dev")
  })

  it.each([
    ["vazio", ""],
    ["só espaços", "   "],
    ["sem arroba", "privacidade.ritu.dev"],
    ["sem domínio", "privacidade@"],
    ["com espaço no meio", "priv acidade@ritu.dev"],
    ["texto qualquer", "não sei"],
  ])("devolve null quando o valor é %s", (_, valor) => {
    expect(contatoDePrivacidade(valor)).toBeNull()
  })

  it("devolve null quando a variável está ausente", () => {
    expect(contatoDePrivacidade(undefined)).toBeNull()
  })
})
