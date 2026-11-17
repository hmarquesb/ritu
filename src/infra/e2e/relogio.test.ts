import { describe, expect, it } from "vitest"
import { createRelogioDoE2e } from "./relogio"

describe("relógio do modo e2e", () => {
  it("parte de 20h30 UTC do dia e anda como o real", () => {
    let agora = new Date("2026-03-10T03:15:00Z").getTime()
    const relogio = createRelogioDoE2e(() => new Date(agora))
    expect(relogio.now().toISOString()).toBe("2026-03-10T20:30:00.000Z")
    agora += 90_000
    expect(relogio.now().toISOString()).toBe("2026-03-10T20:31:30.000Z")
  })
})
