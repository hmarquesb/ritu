import { llmCotas } from "@config/llm-cotas"
import { describe, expect, it } from "vitest"
import { diaDaCota } from "@/core/llm/router"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger } from "@/infra/fakes/memory-stores"

const principal = llmCotas.papeis.decisao[0]
const LIMITE_DE_UM_POR_DIA = { rpm: 100, tpm: 250_000, rpd: 1 }
const LIMITES = { [principal]: LIMITE_DE_UM_POR_DIA }
const CONFIG = { rpm: 100, tpm: 250_000, rpd: 500 }

describe("virada: o dia da cota vira à meia-noite do Pacífico", () => {
  it("diaDaCota segue o fuso de Los Angeles, com PST e com PDT", () => {
    expect(diaDaCota(new Date("2026-01-15T07:59:59Z"))).toBe("2026-01-14")
    expect(diaDaCota(new Date("2026-01-15T08:00:00Z"))).toBe("2026-01-15")
    expect(diaDaCota(new Date("2026-07-01T06:59:59Z"))).toBe("2026-06-30")
    expect(diaDaCota(new Date("2026-07-01T07:00:00Z"))).toBe("2026-07-01")
  })

  it("a meia-noite UTC não zera o registro; a meia-noite do Pacífico zera", async () => {
    const clock = createFixedClock("2026-01-14T23:59:00Z")
    const ledger = createMemoryLedger(clock, LIMITES)

    expect(await ledger.reservar(principal, CONFIG)).toBe(true)

    clock.set("2026-01-15T00:01:00Z")
    expect(await ledger.reservar(principal, CONFIG)).toBe(false)

    clock.set("2026-01-15T08:00:00Z")
    expect(await ledger.reservar(principal, CONFIG)).toBe(true)
    const uso = (await ledger.uso()).find((u) => u.modelo === principal)
    expect(uso?.dia.pedidos).toBe(1)
  })
})
