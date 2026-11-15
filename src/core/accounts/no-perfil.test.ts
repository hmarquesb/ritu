import { describe, expect, it } from "vitest"
import { citadoNoPerfilDoNaoCome, itemNoPerfilDoEvitar } from "@/core/accounts/no-perfil"
import type { Perfil } from "@/core/accounts/types"

const perfil: Perfil = {
  conta_id: "c1",
  prakriti: null,
  origem: null,
  evitar_sempre: [
    { tipo: "grupo", valor: "frutos_do_mar", desde: "2026-01-01" },
    { tipo: "alimento", valor: "coentro", desde: "2026-01-01" },
  ],
  restricoes: [],
  nao_come: [
    { tipo: "alimento", valor: "abobora" },
    { tipo: "texto", valor: "pimenta calabresa" },
  ],
  cidade_nome: null,
  cidade_lat: null,
  cidade_lon: null,
  cidade_fuso: null,
  atualizado_em: "2026-01-01",
}

describe("citadoNoPerfilDoNaoCome", () => {
  it("acha o alimento guardado pelo id", () => {
    expect(citadoNoPerfilDoNaoCome({ alimento_id: "abobora", nome: "Abóbora" }, perfil)).toBe(true)
  })

  it("acha o texto livre guardado pelo nome normalizado, com acento e caixa diferentes", () => {
    expect(citadoNoPerfilDoNaoCome({ nome: "  Pimentá-Calabresa " }, perfil)).toBe(true)
  })

  it("não acha o que não está guardado", () => {
    expect(citadoNoPerfilDoNaoCome({ alimento_id: "couve", nome: "Couve" }, perfil)).toBe(false)
    expect(citadoNoPerfilDoNaoCome({ nome: "pimenta" }, perfil)).toBe(false)
  })
})

describe("itemNoPerfilDoEvitar", () => {
  it("acha o item guardado com o mesmo tipo e valor", () => {
    expect(itemNoPerfilDoEvitar({ tipo: "alimento", valor: "coentro" }, perfil)).toBe(true)
    expect(itemNoPerfilDoEvitar({ tipo: "grupo", valor: "frutos_do_mar" }, perfil)).toBe(true)
  })

  it("não acha o item com o mesmo valor e outro tipo, nem o que não está guardado", () => {
    expect(itemNoPerfilDoEvitar({ tipo: "texto", valor: "coentro" }, perfil)).toBe(false)
    expect(itemNoPerfilDoEvitar({ tipo: "alimento", valor: "couve" }, perfil)).toBe(false)
  })
})
