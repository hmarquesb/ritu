import { describe, expect, it } from "vitest"
import { horaLocal } from "./hora-local"

describe("horaLocal", () => {
  it("15h30 UTC em São Paulo é 12", () => {
    expect(horaLocal(new Date("2026-01-15T15:30:00Z"), "America/Sao_Paulo")).toBe(12)
  })

  it("15h30 UTC em Lisboa é 15", () => {
    expect(horaLocal(new Date("2026-01-15T15:30:00Z"), "Europe/Lisbon")).toBe(15)
  })

  it("fuso inválido usa o fuso padrão (São Paulo)", () => {
    expect(horaLocal(new Date("2026-01-15T15:30:00Z"), "Nada/Inexistente")).toBe(12)
  })

  it("meia-noite devolve 0, não 24", () => {
    expect(horaLocal(new Date("2026-01-15T03:00:00Z"), "America/Sao_Paulo")).toBe(0)
  })
})
