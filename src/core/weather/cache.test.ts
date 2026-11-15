import { describe, expect, it } from "vitest"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createCachedWeatherSource } from "./cache"
import { WeatherUnavailableError } from "./ports"

const RIO = { lat: -22.91, lon: -43.17 }
const SAO_PAULO = { lat: -23.55, lon: -46.63 }
const MINUTO = 60_000

function montar() {
  const clock = createFixedClock("2026-01-15T12:00:00Z")
  const porta = createFakeWeather()
  const cache = createCachedWeatherSource(porta, clock)
  return { clock, porta, cache }
}

describe("createCachedWeatherSource", () => {
  it("não chama a porta de novo dentro de 60 minutos", async () => {
    const { clock, porta, cache } = montar()

    await cache.buscar(RIO)
    await cache.buscar(RIO)

    expect(porta.chamadas).toBe(1)

    clock.advance(60 * MINUTO + 1)
    await cache.buscar(RIO)

    expect(porta.chamadas).toBe(2)
  })

  it("cidades diferentes não dividem cache", async () => {
    const { porta, cache } = montar()

    await cache.buscar(RIO)
    await cache.buscar(SAO_PAULO)

    expect(porta.chamadas).toBe(2)
  })

  it("coordenadas com mais casas decimais usam a mesma chave", async () => {
    const { porta, cache } = montar()

    await cache.buscar({ lat: -22.9068, lon: -43.1729 })
    await cache.buscar({ lat: -22.91, lon: -43.17 })

    expect(porta.chamadas).toBe(1)
  })

  it("falha não fica em cache", async () => {
    const { porta, cache } = montar()
    porta.foraDoAr(true)

    await expect(cache.buscar(RIO)).rejects.toBeInstanceOf(WeatherUnavailableError)

    porta.foraDoAr(false)
    await expect(cache.buscar(RIO)).resolves.toBeDefined()
    expect(porta.chamadas).toBe(2)
  })

  it("falha depois de sucesso em cache válido devolve o cache", async () => {
    const { clock, porta, cache } = montar()
    const primeiro = await cache.buscar(RIO)

    porta.foraDoAr(true)
    clock.advance(10 * MINUTO)

    await expect(cache.buscar(RIO)).resolves.toEqual(primeiro)
    expect(porta.chamadas).toBe(1)
  })

  it("duas chamadas simultâneas para a mesma chave viram um pedido à porta", async () => {
    const { porta, cache } = montar()

    const [a, b] = await Promise.all([cache.buscar(RIO), cache.buscar(RIO)])

    expect(porta.chamadas).toBe(1)
    expect(a).toEqual(b)
  })
})
