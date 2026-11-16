import { describe, expect, it } from "vitest"
import type { EntradaDoAcompanhante } from "@/core/agents/companion/entrada"
import { type DadosDoPreparo, preparar } from "@/core/agents/companion/preparo"
import { getContainer } from "@/infra/container"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"

const kb = getContainer().knowledge
const CONTA = "conta-1"
// 19h em São Paulo: momento "jantar", como em faltas.eval.ts.
const JANTAR = "2026-11-15T22:00:00.000Z"
const ESTADOS = ["com_frio", "pesada"] as const

function montar() {
  const clock = createFixedClock(JANTAR)
  const stores = createMemoryStores(clock)
  const deps = { stores, kb, clock, telemetry: createMemoryTelemetry() }
  const run = (parcial: Partial<EntradaDoAcompanhante> = {}): Promise<DadosDoPreparo> =>
    preparar(deps, CONTA, {
      intencoes: ["momento"],
      estados: [...ESTADOS],
      evitar_da_mensagem: [],
      ...parcial,
    })
  return { stores, run }
}

async function registrarDias(
  stores: ReturnType<typeof montar>["stores"],
  alimento_id: string,
  dias: string[],
) {
  for (const dia of dias) {
    await stores.shortages.registrar(CONTA, [{ alimento_id, origem: "nao_tenho" }], dia)
  }
}

describe("para ter: no máximo um candidato por run", () => {
  it("dois alimentos com três dias de falta: a saída traz um só, o de mais dias", async () => {
    const { stores, run } = montar()
    const dados = await run()
    const [primeiro, segundo] = dados.faltas_do_run
    expect(primeiro && segundo, "há duas faltas do run").toBeDefined()
    if (!primeiro || !segundo) return

    await registrarDias(stores, primeiro, ["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"])
    await registrarDias(stores, segundo, ["2026-11-12", "2026-11-13", "2026-11-14"])

    const com = await run()
    expect(com.para_ter?.alimento_id).toBe(primeiro)
    // Quatro dias anteriores mais a falta de hoje.
    expect(com.para_ter?.vezes).toBe(5)
    expect(com.para_ter?.alimento_id).not.toBe(segundo)
  })

  it("empate em dias: um só vira para_ter, e o outro segue como falta do run", async () => {
    const { stores, run } = montar()
    const dados = await run()
    const [primeiro, segundo] = dados.faltas_do_run
    if (!primeiro || !segundo) throw new Error("há duas faltas do run")

    await registrarDias(stores, primeiro, ["2026-11-12", "2026-11-13", "2026-11-14"])
    await registrarDias(stores, segundo, ["2026-11-12", "2026-11-13", "2026-11-14"])

    const com = await run()
    expect([primeiro, segundo]).toContain(com.para_ter?.alimento_id)
    const outro = com.para_ter?.alimento_id === primeiro ? segundo : primeiro
    expect(com.faltas_do_run).toContain(outro)
  })
})
