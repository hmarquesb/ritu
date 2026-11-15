import { describe, expect, it } from "vitest"
import { diaDaCota, janelaDoMinuto } from "./janelas"

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
