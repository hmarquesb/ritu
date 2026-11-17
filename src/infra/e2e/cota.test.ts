import { describe, expect, it } from "vitest"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createLedgerE2e } from "./cota"

const limites = { rpm: 2, tpm: 1000, rpd: 100 }

function setup() {
  const clock = createFixedClock("2026-01-15T12:00:00Z")
  let id: string | undefined
  const ledger = createLedgerE2e(clock, async () => id)
  return { ledger, usar: (novo: string | undefined) => (id = novo) }
}

describe("ledger do modo e2e", () => {
  it("cada x-ritu-e2e tem a sua cota", async () => {
    const { ledger, usar } = setup()
    usar("a")
    expect(await ledger.reservar("m", limites)).toBe(true)
    expect(await ledger.reservar("m", limites)).toBe(true)
    expect(await ledger.reservar("m", limites)).toBe(false)
    usar("b")
    expect(await ledger.reservar("m", limites)).toBe(true)
    usar("a")
    expect(await ledger.reservar("m", limites)).toBe(false)
  })

  it("sem header há um ledger só", async () => {
    const { ledger, usar } = setup()
    usar(undefined)
    await ledger.reservar("m", limites)
    await ledger.reservar("m", limites)
    expect(await ledger.reservar("m", limites)).toBe(false)
  })
})
