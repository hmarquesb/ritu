import { describe, expect, it, vi } from "vitest"
import { WeatherUnavailableError } from "@/core/weather/ports"
import { createOpenMeteoWeather } from "./weather"

const CORPO_OK = {
  latitude: -22.91,
  longitude: -43.17,
  current: { time: "2026-01-15T12:00", apparent_temperature: 28.4, relative_humidity_2m: 70 },
  hourly: {
    time: [
      "2026-01-15T12:00",
      "2026-01-15T13:00",
      "2026-01-15T14:00",
      "2026-01-15T15:00",
      "2026-01-15T16:00",
      "2026-01-15T17:00",
      "2026-01-15T18:00",
    ],
    apparent_temperature: [28.4, 29, 29.5, 30, 30.2, 29.8, 29.1],
    precipitation_probability: [10, null, 20, 40, 60, 80, 90],
  },
}

function fetchFalso(corpo: unknown, status = 200) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(corpo), { status }))
}

function urlChamada(mock: ReturnType<typeof fetchFalso>): URL {
  return new URL(String(mock.mock.calls[0]?.[0]))
}

describe("createOpenMeteoWeather", () => {
  it("chama a previsão com coordenadas arredondadas a duas casas e os parâmetros do contrato", async () => {
    const mock = fetchFalso(CORPO_OK)

    await createOpenMeteoWeather({ fetch: mock }).buscar({ lat: -22.9068, lon: -43.1729 })

    const url = urlChamada(mock)
    expect(url.origin + url.pathname).toBe("https://api.open-meteo.com/v1/forecast")
    expect(url.searchParams.get("latitude")).toBe("-22.91")
    expect(url.searchParams.get("longitude")).toBe("-43.17")
    expect(url.searchParams.get("current")).toBe("apparent_temperature,relative_humidity_2m")
    expect(url.searchParams.get("hourly")).toBe("apparent_temperature,precipitation_probability")
    expect(url.searchParams.get("forecast_hours")).toBe("7")
    expect(url.searchParams.get("timezone")).toBe("auto")
  })

  it("devolve o clima atual e as 6 horas seguintes, sem a hora atual", async () => {
    const clima = await createOpenMeteoWeather({ fetch: fetchFalso(CORPO_OK) }).buscar({
      lat: -22.91,
      lon: -43.17,
    })

    expect(clima.temperatura_aparente).toBe(28.4)
    expect(clima.umidade).toBe(70)
    expect(clima.observado_em).toBe("2026-01-15T12:00")
    expect(clima.proximas_horas).toHaveLength(6)
    expect(clima.proximas_horas[0]).toEqual({
      hora: "2026-01-15T13:00",
      temperatura_aparente: 29,
      prob_chuva: 0,
    })
    expect(clima.proximas_horas[5]?.hora).toBe("2026-01-15T18:00")
  })

  it("trata probabilidade de chuva nula como zero", async () => {
    const clima = await createOpenMeteoWeather({ fetch: fetchFalso(CORPO_OK) }).buscar({
      lat: -22.91,
      lon: -43.17,
    })

    expect(clima.proximas_horas[0]?.prob_chuva).toBe(0)
    expect(clima.proximas_horas[1]?.prob_chuva).toBe(20)
  })

  it("lança WeatherUnavailableError com status diferente de 200", async () => {
    const adaptador = createOpenMeteoWeather({ fetch: fetchFalso({}, 500) })

    await expect(adaptador.buscar({ lat: -22.91, lon: -43.17 })).rejects.toBeInstanceOf(
      WeatherUnavailableError,
    )
  })

  it("lança WeatherUnavailableError quando o corpo não tem current", async () => {
    const { current: _ignorado, ...semAtual } = CORPO_OK
    const adaptador = createOpenMeteoWeather({ fetch: fetchFalso(semAtual) })

    await expect(adaptador.buscar({ lat: -22.91, lon: -43.17 })).rejects.toBeInstanceOf(
      WeatherUnavailableError,
    )
  })

  it("lança WeatherUnavailableError quando o fetch falha na rede", async () => {
    const mock = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed")
    })
    const adaptador = createOpenMeteoWeather({ fetch: mock })

    await expect(adaptador.buscar({ lat: -22.91, lon: -43.17 })).rejects.toBeInstanceOf(
      WeatherUnavailableError,
    )
  })

  it("lança WeatherUnavailableError quando o timeout estoura", async () => {
    const mock = vi.fn<typeof fetch>(async () => {
      throw new DOMException("timeout", "TimeoutError")
    })
    const adaptador = createOpenMeteoWeather({ fetch: mock })

    await expect(adaptador.buscar({ lat: -22.91, lon: -43.17 })).rejects.toMatchObject({
      code: "clima_indisponivel",
    })
  })
})
