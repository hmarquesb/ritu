import { describe, expect, it } from "vitest"
import { diaDaCota, horaLocal, janelaDoMinuto, viradaDaCota } from "./janelas"

describe("janelaDoMinuto", () => {
  it("devolve o início do minuto em ISO UTC", () => {
    expect(janelaDoMinuto(new Date("2026-01-15T12:34:56.789Z"))).toBe("2026-01-15T12:34:00.000Z")
  })
})

describe("diaDaCota", () => {
  it("às 23h59 em Los Angeles ainda é o dia anterior", () => {
    expect(diaDaCota(new Date("2026-01-16T07:59:00Z"))).toBe("2026-01-15")
  })

  it("à 0h01 em Los Angeles já é o dia seguinte", () => {
    expect(diaDaCota(new Date("2026-01-16T08:01:00Z"))).toBe("2026-01-16")
  })

  it("no horário de verão (UTC−7) a virada também é à meia-noite local", () => {
    expect(diaDaCota(new Date("2026-07-15T06:59:00Z"))).toBe("2026-07-14")
    expect(diaDaCota(new Date("2026-07-15T07:01:00Z"))).toBe("2026-07-15")
  })
})

describe("viradaDaCota", () => {
  it("é a próxima meia-noite de Los Angeles (horário padrão, UTC−8)", () => {
    expect(viradaDaCota(new Date("2026-01-15T12:00:00Z")).toISOString()).toBe(
      "2026-01-16T08:00:00.000Z",
    )
  })

  it("no horário de verão a meia-noite cai às 07h UTC", () => {
    expect(viradaDaCota(new Date("2026-07-15T12:00:00Z")).toISOString()).toBe(
      "2026-07-16T07:00:00.000Z",
    )
  })

  it("às 23h59 locais a virada é a meia-noite seguinte, não a anterior", () => {
    expect(viradaDaCota(new Date("2026-01-16T07:59:00Z")).toISOString()).toBe(
      "2026-01-16T08:00:00.000Z",
    )
  })

  it("à 0h01 locais a virada já é a do dia seguinte", () => {
    expect(viradaDaCota(new Date("2026-01-16T08:01:00Z")).toISOString()).toBe(
      "2026-01-17T08:00:00.000Z",
    )
  })
})

describe("horaLocal", () => {
  it("devolve a hora cheia sem zero à esquerda e sem minutos", () => {
    expect(horaLocal(new Date("2026-01-16T08:00:00Z"), "America/Sao_Paulo")).toBe("5h")
  })

  it("na mesma virada, em horário de verão de Los Angeles, dá 4h em São Paulo", () => {
    expect(horaLocal(viradaDaCota(new Date("2026-07-15T12:00:00Z")), "America/Sao_Paulo")).toBe(
      "4h",
    )
  })

  it("com a virada de janeiro, dá 5h em São Paulo", () => {
    expect(horaLocal(viradaDaCota(new Date("2026-01-15T12:00:00Z")), "America/Sao_Paulo")).toBe(
      "5h",
    )
  })

  it("com meia hora de fuso, mostra os minutos (13h30 em Kolkata)", () => {
    expect(horaLocal(viradaDaCota(new Date("2026-01-15T12:00:00Z")), "Asia/Kolkata")).toBe("13h30")
  })

  it("minutos com um dígito ganham zero à esquerda", () => {
    expect(horaLocal(new Date("2026-01-16T08:35:00Z"), "Asia/Kolkata")).toBe("14h05")
  })
})
