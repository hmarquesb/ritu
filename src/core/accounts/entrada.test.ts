import { describe, expect, it } from "vitest"
import { estadoDaEntrada } from "./entrada"

const base = { google: false, demosHoje: 0, tetoGlobal: 100 }

describe("estadoDaEntrada", () => {
  it("sem aviso nem erro, com demo disponível e sem Google", () => {
    expect(estadoDaEntrada(base)).toEqual({ demo: true, google: false })
  })

  it("demo some quando o teto global é atingido e força o aviso de limite global", () => {
    expect(estadoDaEntrada({ ...base, demosHoje: 100, google: true })).toEqual({
      demo: false,
      google: true,
      aviso: "demo_limite_global",
    })
  })

  it("o teto força o aviso mesmo quando veio outro aviso", () => {
    expect(estadoDaEntrada({ ...base, demosHoje: 120, aviso: "demo_limite_ip" }).aviso).toBe(
      "demo_limite_global",
    )
  })

  it("dados_apagados é um aviso conhecido", () => {
    expect(estadoDaEntrada({ ...base, aviso: "dados_apagados" }).aviso).toBe("dados_apagados")
  })

  it("aviso conhecido passa adiante", () => {
    expect(estadoDaEntrada({ ...base, aviso: "demo_expirou" })).toEqual({
      demo: true,
      google: false,
      aviso: "demo_expirou",
    })
  })

  it("aviso desconhecido é ignorado", () => {
    expect(estadoDaEntrada({ ...base, aviso: "qualquer_coisa" })).toEqual({
      demo: true,
      google: false,
    })
  })

  it("erro do Auth.js vira erro_google", () => {
    expect(estadoDaEntrada({ ...base, google: true, erro: "OAuthCallback" })).toEqual({
      demo: true,
      google: true,
      aviso: "erro_google",
    })
  })

  it("Google ausente aparece como false", () => {
    expect(estadoDaEntrada({ ...base, google: false }).google).toBe(false)
  })
})
