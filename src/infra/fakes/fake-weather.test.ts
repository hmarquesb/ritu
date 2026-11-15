import { describe, expect, it } from "vitest"
import { CityLookupUnavailableError, WeatherUnavailableError } from "@/core/weather/ports"
import { createFakeCities } from "./fake-cities"
import { createFakeWeather } from "./fake-weather"

const COORDENADAS = { lat: -22.91, lon: -43.17 }

describe("createFakeWeather", () => {
  it("devolve o clima padrão estável e sem chuva", async () => {
    const clima = await createFakeWeather().buscar(COORDENADAS)

    expect(clima.temperatura_aparente).toBe(24)
    expect(clima.umidade).toBe(60)
    expect(clima.observado_em).toBe("2026-01-15T12:00:00-03:00")
    expect(clima.proximas_horas).toHaveLength(6)
    expect(
      clima.proximas_horas.every((h) => h.temperatura_aparente === 24 && h.prob_chuva === 0),
    ).toBe(true)
  })

  it("aceita valores iniciais e set troca campos", async () => {
    const fake = createFakeWeather({ umidade: 80 })
    expect((await fake.buscar(COORDENADAS)).umidade).toBe(80)

    fake.set({ temperatura_aparente: 30 })
    const clima = await fake.buscar(COORDENADAS)
    expect(clima.temperatura_aparente).toBe(30)
    expect(clima.umidade).toBe(80)
  })

  it("conta as chamadas a buscar", async () => {
    const fake = createFakeWeather()

    await fake.buscar(COORDENADAS)
    await fake.buscar(COORDENADAS)

    expect(fake.chamadas).toBe(2)
  })

  it("fora do ar lança WeatherUnavailableError", async () => {
    const fake = createFakeWeather()
    fake.foraDoAr(true)

    await expect(fake.buscar(COORDENADAS)).rejects.toBeInstanceOf(WeatherUnavailableError)
  })
})

describe("createFakeCities", () => {
  it("acha uma cidade pelo início do nome", async () => {
    const cidades = await createFakeCities().buscar("rio")

    expect(cidades.map((c) => c.nome)).toContain("Rio de Janeiro")
  })

  it("com menos de 2 caracteres devolve lista vazia", async () => {
    expect(await createFakeCities().buscar("r")).toEqual([])
  })

  it("acha São Paulo com e sem acento", async () => {
    const fake = createFakeCities()

    expect((await fake.buscar("são")).map((c) => c.nome)).toContain("São Paulo")
    expect((await fake.buscar("sao")).map((c) => c.nome)).toContain("São Paulo")
  })

  it("fora do ar lança CityLookupUnavailableError", async () => {
    const fake = createFakeCities()
    fake.foraDoAr(true)

    await expect(fake.buscar("rio")).rejects.toBeInstanceOf(CityLookupUnavailableError)
  })
})
