import { describe, expect, it } from "vitest"
import { createFixedClock } from "./fixed-clock"

describe("createFixedClock", () => {
  it("devolve sempre a mesma data em chamadas sucessivas", () => {
    const clock = createFixedClock("2026-01-15T12:00:00Z")

    expect(clock.now().toISOString()).toBe("2026-01-15T12:00:00.000Z")
    expect(clock.now().toISOString()).toBe("2026-01-15T12:00:00.000Z")
  })

  it("advance avança o tempo em milissegundos", () => {
    const clock = createFixedClock("2026-01-15T12:00:00Z")

    clock.advance(60_000)

    expect(clock.now().toISOString()).toBe("2026-01-15T12:01:00.000Z")
  })

  it("set troca a data", () => {
    const clock = createFixedClock("2026-01-15T12:00:00Z")

    clock.set("2026-03-01T08:30:00Z")

    expect(clock.now().toISOString()).toBe("2026-03-01T08:30:00.000Z")
  })

  it("mutar o Date devolvido não altera o próximo now()", () => {
    const clock = createFixedClock("2026-01-15T12:00:00Z")

    clock.now().setUTCFullYear(1999)

    expect(clock.now().toISOString()).toBe("2026-01-15T12:00:00.000Z")
  })
})
