import { describe, expect, it } from "vitest"
import { type DadosDoPreparo, preparar } from "@/core/agents/companion/preparo"
import { filtroVazio } from "@/core/knowledge/filtros"
import { sinaisVazios, substitutos } from "@/core/knowledge/substitutos"
import { getContainer } from "@/infra/container"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"

// Alimento que a base não conhece fica guardado na casa, mas não vira sugestão nem troca.
const kb = getContainer().knowledge
const CONTA = "conta-1"
// 19h em São Paulo: momento "jantar", como em faltas.eval.ts.
const JANTAR = "2026-11-15T22:00:00.000Z"
const DESCONHECIDO = "pitaia"

function montar() {
  const clock = createFixedClock(JANTAR)
  const stores = createMemoryStores(clock)
  const deps = { stores, kb, clock, telemetry: createMemoryTelemetry() }
  const run = (): Promise<DadosDoPreparo> =>
    preparar(deps, CONTA, {
      intencoes: ["momento"],
      estados: ["com_frio", "pesada"],
      evitar_da_mensagem: [],
    })
  return { stores, run }
}

describe("alimento fora da base: guardado, fora de sugestão e de troca", () => {
  it("com o alimento em casa, os candidatos só trazem alimentos da base", async () => {
    const { stores, run } = montar()
    await stores.pantry.registrar(CONTA, [{ alimento_id: DESCONHECIDO }], "conversa")

    const dados = await run()

    for (const candidato of dados.candidatos) {
      for (const item of [...candidato.itens, ...Object.values(candidato.opcoes ?? {}).flat()]) {
        expect(kb.alimento(item.alimento_id), item.alimento_id).toBeDefined()
      }
    }
    expect(JSON.stringify(dados.candidatos)).not.toContain(DESCONHECIDO)
  })

  it("com o alimento em casa, a troca não o devolve como substituto", () => {
    const trocas = substitutos(
      {
        alimento_id: "canela",
        outros_itens: [],
        filtro: filtroVazio,
        sinais: { ...sinaisVazios, em_casa: [DESCONHECIDO] },
        limite: 10,
      },
      kb,
    )

    expect(trocas.length).toBeGreaterThan(0)
    for (const troca of trocas) {
      expect(kb.alimento(troca.alimento_id), troca.alimento_id).toBeDefined()
      expect(troca.alimento_id).not.toBe(DESCONHECIDO)
    }
  })
})
