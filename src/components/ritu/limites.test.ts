import { config } from "@config/index"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { avisarLimiteDeToque, textoDoLimite } from "./limites"

const avisos = vi.hoisted(() => vi.fn())
vi.mock("@/components/base/toast", () => ({ toast: avisos }))

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

describe("avisarLimiteDeToque", () => {
  beforeEach(() => avisos.mockClear())
  const barrada = (erro: string, retry?: string) =>
    new Response(JSON.stringify({ erro }), {
      status: 429,
      headers: retry ? { "Retry-After": retry } : {},
    })

  it("429 de toque mostra o aviso do minuto", async () => {
    expect(await avisarLimiteDeToque(barrada("limite_toques", "20"))).toBe(true)
    expect(avisos).toHaveBeenCalledWith(config.textosLimites.toques.minuto)
  })
  it("429 de toque com espera longa mostra o aviso do dia", async () => {
    expect(await avisarLimiteDeToque(barrada("limite_toques", "7200"))).toBe(true)
    expect(avisos).toHaveBeenCalledWith(config.textosLimites.toques.dia)
  })
  it("outras respostas não são tratadas", async () => {
    expect(await avisarLimiteDeToque(new Response("{}", { status: 500 }))).toBe(false)
    expect(await avisarLimiteDeToque(barrada("outro"))).toBe(false)
    expect(avisos).not.toHaveBeenCalled()
  })
})
