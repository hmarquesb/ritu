import { describe, expect, it } from "vitest"
import { RituError } from "@/core/errors"
import { filtroVazio } from "@/core/knowledge/filtros"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import { createFakeCities } from "@/infra/fakes/fake-cities"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { contextoPublico, type DepsPublicas, storesProibidos } from "./contexto"

function deps(): DepsPublicas {
  return {
    kb: createMiniKnowledge(),
    clima: createFakeWeather(),
    cidades: createFakeCities(),
    clock: createFixedClock("2026-01-15T12:00:00Z"),
    telemetry: createMemoryTelemetry(),
  }
}

describe("contextoPublico", () => {
  it("monta o contexto neutro: sem filtro da pessoa, sem sinais, sem prakriti e com contaId mcp", () => {
    const d = deps()
    const ctx = contextoPublico(d)

    expect(ctx.kb).toBe(d.kb)
    expect(ctx.filtro).toEqual(filtroVazio)
    expect(ctx.sinais).toEqual(sinaisVazios)
    expect(ctx.prakriti).toBeUndefined()
    expect(ctx.contaId).toBe("mcp")
    expect(ctx.clima).toEqual({ fonte: d.clima, cidade: undefined })
    expect(ctx.clock).toBe(d.clock)
    expect(ctx.telemetry).toBe(d.telemetry)
    expect(ctx.fuso).toBeUndefined()
  })

  it("leva o prakriti, a cidade e o fuso quando vêm nos extras", () => {
    const cidade = { nome: "Recife", lat: -8.05, lon: -34.88, fuso: "America/Sao_Paulo" }
    const ctx = contextoPublico(deps(), { prakriti: { vata: 1 }, cidade })

    expect(ctx.prakriti).toEqual({ vata: 1 })
    expect(ctx.clima.cidade).toEqual(cidade)
    expect(ctx.fuso).toBe("America/Sao_Paulo")
  })

  it("usa storesProibidos como stores", () => {
    expect(contextoPublico(deps()).stores).toBe(storesProibidos)
  })
})

describe("storesProibidos", () => {
  it.each(["pantry", "preferences", "runs", "outcomes", "qualquer"] as const)(
    "acessar %s lança mcp_sem_conta",
    (propriedade) => {
      let erro: unknown
      try {
        void (storesProibidos as Record<string, unknown>)[propriedade]
      } catch (e) {
        erro = e
      }
      expect(erro).toBeInstanceOf(RituError)
      expect((erro as RituError).code).toBe("mcp_sem_conta")
    },
  )
})
