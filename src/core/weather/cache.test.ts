import { describe, expect, it } from "vitest"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryTelemetry, type MemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createCachedWeatherSource } from "./cache"
import { type WeatherSource, WeatherUnavailableError } from "./ports"

const RIO = { lat: -22.91, lon: -43.17 }
const SAO_PAULO = { lat: -23.55, lon: -46.63 }
const MINUTO = 60_000

function montar() {
  const clock = createFixedClock("2026-01-15T12:00:00Z")
  const porta = createFakeWeather()
  const telemetry = createMemoryTelemetry()
  const cache = createCachedWeatherSource(porta, clock, telemetry)
  return { clock, porta, cache, telemetry }
}

// Cada consulta num span `tool.chamada`, como a tool de clima faz.
function consultar(telemetry: MemoryTelemetry, cache: WeatherSource, c = RIO) {
  return telemetry.span("tool.chamada", {}, () => cache.buscar(c))
}

function marcas(telemetry: MemoryTelemetry): unknown[] {
  return telemetry.spans.map((s) => s.atributos["cache.hit"])
}

describe("createCachedWeatherSource", () => {
  it("não chama a porta de novo dentro de 60 minutos", async () => {
    const { clock, porta, cache, telemetry } = montar()

    await cache.buscar(RIO)
    await cache.buscar(RIO)

    expect(porta.chamadas).toBe(1)

    clock.advance(60 * MINUTO + 1)
    await cache.buscar(RIO)

    expect(porta.chamadas).toBe(2)
    expect(telemetry.logs).toEqual([])
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

  it("marca cache.hit false na primeira busca e true dentro da validade", async () => {
    const { cache, telemetry } = montar()

    await consultar(telemetry, cache)
    await consultar(telemetry, cache)

    expect(marcas(telemetry)).toEqual([false, true])
  })

  it("marca cache.hit false depois da validade", async () => {
    const { clock, cache, telemetry } = montar()

    await consultar(telemetry, cache)
    clock.advance(60 * MINUTO + 1)
    await consultar(telemetry, cache)

    expect(marcas(telemetry)).toEqual([false, false])
  })

  it("marca cache.hit false quando espera um pedido em voo", async () => {
    const { cache, telemetry } = montar()

    await Promise.all([consultar(telemetry, cache), consultar(telemetry, cache)])

    expect(marcas(telemetry)).toEqual([false, false])
  })

  it("fonte fora do ar loga clima_indisponivel com o código e o erro sobe", async () => {
    const { porta, cache, telemetry } = montar()
    porta.foraDoAr(true)

    await expect(consultar(telemetry, cache)).rejects.toBeInstanceOf(WeatherUnavailableError)

    expect(telemetry.logs).toHaveLength(1)
    expect(telemetry.logs[0]?.codigo).toBe("clima_indisponivel")
    expect(telemetry.logs[0]?.nivel).toBe("warn")
    expect(telemetry.logs[0]?.campos["erro.codigo"]).toBe("clima_indisponivel")
  })

  it("loga uma vez por falha da fonte, não por quem esperou o mesmo pedido", async () => {
    const { porta, cache, telemetry } = montar()
    porta.foraDoAr(true)

    await Promise.allSettled([cache.buscar(RIO), cache.buscar(RIO), cache.buscar(RIO)])

    expect(porta.chamadas).toBe(1)
    expect(telemetry.logs.filter((l) => l.codigo === "clima_indisponivel")).toHaveLength(1)
  })

  it("erro que não é RituError loga erro.codigo desconhecido", async () => {
    const clock = createFixedClock("2026-01-15T12:00:00Z")
    const telemetry = createMemoryTelemetry()
    const quebrada: WeatherSource = {
      async buscar() {
        throw new Error("boom")
      },
    }
    const cache = createCachedWeatherSource(quebrada, clock, telemetry)

    await expect(consultar(telemetry, cache)).rejects.toThrow("boom")

    expect(telemetry.logs[0]?.campos["erro.codigo"]).toBe("desconhecido")
  })

  it("fora de span não lança e não marca nada", async () => {
    const { cache, telemetry } = montar()

    await expect(cache.buscar(RIO)).resolves.toBeDefined()
    await expect(cache.buscar(RIO)).resolves.toBeDefined()

    expect(telemetry.spans).toEqual([])
  })
})
