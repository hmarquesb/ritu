import { describe, expect, it } from "vitest"
import type { Conta, Perfil } from "@/core/accounts/types"
import { proximoPasso, ROTA_DO_PASSO } from "./onboarding"

const conta: Conta = {
  id: "c1",
  tipo: "google",
  google_sub: "g1",
  email: null,
  expira_em: null,
  tester: false,
  aviso_aceito_em: "2026-01-01",
  evitar_passo: "pronto",
  evitar_lembrete_em: null,
  dosha_adiado_em: null,
  criado_em: "2026-01-01",
}

const perfil: Perfil = {
  conta_id: "c1",
  prakriti: { vata: 1 },
  origem: "quiz",
  evitar_sempre: [],
  restricoes: [],
  nao_come: [],
  cidade_nome: "Belo Horizonte",
  cidade_lat: -19.9,
  cidade_lon: -43.9,
  cidade_fuso: "America/Sao_Paulo",
  atualizado_em: "2026-01-01",
}

describe("proximoPasso", () => {
  it("manda para o aviso quando ele não foi aceito", () => {
    expect(proximoPasso({ ...conta, aviso_aceito_em: null }, perfil)).toBe("aviso")
  })

  it("manda para evitar quando o passo de evitar não foi feito", () => {
    expect(proximoPasso({ ...conta, evitar_passo: null }, perfil)).toBe("evitar")
  })

  it("manda para o dosha quando não há prakriti e a pessoa não adiou", () => {
    expect(proximoPasso({ ...conta }, { ...perfil, prakriti: null })).toBe("dosha")
  })

  it("segue para pronto quando há prakriti", () => {
    expect(proximoPasso(conta, perfil)).toBe("pronto")
  })

  it("segue para pronto quando a pessoa adiou o dosha e não há prakriti", () => {
    expect(
      proximoPasso({ ...conta, dosha_adiado_em: "2026-01-02" }, { ...perfil, prakriti: null }),
    ).toBe("pronto")
  })

  it("não segura o passo por causa da cidade vazia", () => {
    const semCidade = { ...perfil, cidade_nome: null, cidade_lat: null, cidade_lon: null }
    expect(proximoPasso(conta, semCidade)).toBe("pronto")
  })
})

describe("ROTA_DO_PASSO", () => {
  it("aponta cada passo para a sua rota", () => {
    expect(ROTA_DO_PASSO).toEqual({
      aviso: "/comecar/aviso",
      evitar: "/comecar/evitar",
      dosha: "/comecar/dosha",
      pronto: "/conversa",
    })
  })
})
