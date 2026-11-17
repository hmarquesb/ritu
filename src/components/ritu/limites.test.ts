import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import { textoDoLimite } from "./limites"

describe("textoDoLimite", () => {
  it("limite de toques com até 60 s é o aviso do minuto", () => {
    expect(textoDoLimite("limite_toques", 30)).toBe(config.textosLimites.toques.minuto)
    expect(textoDoLimite("limite_toques", 60)).toBe(config.textosLimites.toques.minuto)
  })
  it("limite de toques com espera maior é o aviso do dia", () => {
    expect(textoDoLimite("limite_toques", 3600)).toBe(config.textosLimites.toques.dia)
  })
  it("sem Retry-After é o aviso do dia", () => {
    expect(textoDoLimite("limite_toques")).toBe(config.textosLimites.toques.dia)
  })
  it("outros códigos não têm texto", () => {
    expect(textoDoLimite("limite_ip")).toBeUndefined()
  })
})
