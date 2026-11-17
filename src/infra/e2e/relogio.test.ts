import { describe, expect, it, vi } from "vitest"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createRelogioE2e } from "./relogio"

const BASE = "2026-11-17T12:00:00Z"
const NOITE = "2026-11-18T00:00:00Z"

function relogio() {
  return createRelogioE2e(createFixedClock(BASE))
}

describe("relógio do modo e2e", () => {
  it("com header válido, o relógio devolve o instante dentro do pedido", async () => {
    const { clock, comRelogio } = relogio()
    const visto = await comRelogio(
      async () => NOITE,
      async () => clock.now().toISOString(),
    )
    expect(visto).toBe(new Date(NOITE).toISOString())
  })

  it.each([
    ["sem header", undefined],
    ["header inválido", "ontem à noite"],
    ["header vazio", "  "],
  ])("%s: devolve o relógio de base", async (_nome, valor) => {
    const { clock, comRelogio } = relogio()
    const visto = await comRelogio(
      async () => valor,
      async () => clock.now().toISOString(),
    )
    expect(visto).toBe(new Date(BASE).toISOString())
  })

  it("fora de pedido (leitor que falha), devolve o relógio de base", async () => {
    const { clock, comRelogio } = relogio()
    const visto = await comRelogio(
      async () => {
        throw new Error("fora de pedido")
      },
      async () => clock.now().toISOString(),
    )
    expect(visto).toBe(new Date(BASE).toISOString())
  })

  it("fora de comRelogio, o relógio é o de base", () => {
    expect(relogio().clock.now().toISOString()).toBe(new Date(BASE).toISOString())
  })

  it("o leitor do Next sem pedido em andamento não quebra", async () => {
    vi.resetModules()
    const { instanteDoPedidoNext } = await import("./relogio")
    expect(await instanteDoPedidoNext()).toBeUndefined()
  })
})
