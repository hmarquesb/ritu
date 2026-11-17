import { describe, expect, it } from "vitest"
import { diaLocal, diasAtras, diasEntre } from "./dia-local"

describe("diaLocal", () => {
  it("02h30 UTC em São Paulo ainda é o dia anterior", () => {
    expect(diaLocal(new Date("2026-01-15T02:30:00Z"), "America/Sao_Paulo")).toBe("2026-01-14")
  })

  it("02h30 UTC em Lisboa já é o mesmo dia", () => {
    expect(diaLocal(new Date("2026-01-15T02:30:00Z"), "Europe/Lisbon")).toBe("2026-01-15")
  })

  it("fuso inválido usa o fuso padrão (São Paulo)", () => {
    expect(diaLocal(new Date("2026-01-15T02:30:00Z"), "Nada/Inexistente")).toBe("2026-01-14")
  })

  it("sem fuso usa o fuso padrão (São Paulo)", () => {
    expect(diaLocal(new Date("2026-01-15T02:30:00Z"))).toBe("2026-01-14")
  })
})

describe("diasAtras", () => {
  it("um dia antes de 1º de março é 28 de fevereiro", () => {
    expect(diasAtras("2026-03-01", 1)).toBe("2026-02-28")
  })

  it("sete dias antes de 1º de janeiro cruza o ano", () => {
    expect(diasAtras("2026-01-01", 7)).toBe("2025-12-25")
  })
})

describe("diasEntre", () => {
  it("mesmo dia é zero", () => {
    expect(diasEntre("2026-03-10", "2026-03-10")).toBe(0)
  })

  it("dia seguinte é um", () => {
    expect(diasEntre("2026-03-10", "2026-03-11")).toBe(1)
  })

  it("cruza a virada de mês", () => {
    expect(diasEntre("2026-02-27", "2026-03-02")).toBe(3)
  })

  it("cruza a virada de ano", () => {
    expect(diasEntre("2025-12-30", "2026-01-02")).toBe(3)
  })

  it("ordem invertida dá negativo", () => {
    expect(diasEntre("2026-03-11", "2026-03-10")).toBe(-1)
  })
})
