import { describe, expect, it } from "vitest"
import { createCachedWeatherSource } from "@/core/weather/cache"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"

const RIO = { lat: -22.91, lon: -43.17 }
const SAO_PAULO = { lat: -23.55, lon: -46.63 }

function criar() {
  const fake = createFakeWeather()
  const clock = createFixedClock("2026-01-15T12:00:00-03:00")
  const cache = createCachedWeatherSource(fake, clock, createMemoryTelemetry())
  return { fake, clock, cache }
}

describe("cache do clima", () => {
  it("um pedido por cidade dentro de 60 minutos", async () => {
    const { fake, clock, cache } = criar()

    await cache.buscar(RIO)
    clock.advance(59 * 60_000)
    await cache.buscar(RIO)

    expect(fake.chamadas).toBe(1)
  })

  it("cidades diferentes não dividem cache", async () => {
    const { fake, cache } = criar()

    await cache.buscar(RIO)
    await cache.buscar(SAO_PAULO)

    expect(fake.chamadas).toBe(2)
  })
})
