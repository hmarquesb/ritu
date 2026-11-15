import { clima } from "@config/clima"
import { z } from "zod"
import {
  type Clima,
  type Coordenadas,
  type PrevisaoHora,
  type WeatherSource,
  WeatherUnavailableError,
} from "@/core/weather/ports"

const URL_PREVISAO = "https://api.open-meteo.com/v1/forecast"
const HORAS_PROXIMAS = 6
const TAMANHO_HORA_ISO = 13 // "YYYY-MM-DDTHH"

const respostaSchema = z.object({
  current: z.object({
    time: z.string(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number(),
  }),
  hourly: z.object({
    time: z.array(z.string()),
    apparent_temperature: z.array(z.number()),
    precipitation_probability: z.array(z.number().nullable()),
  }),
})

type Resposta = z.infer<typeof respostaSchema>

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100
}

function horaDe(iso: string): string {
  return iso.slice(0, TAMANHO_HORA_ISO)
}

function proximasDe(hourly: Resposta["hourly"], atual: string): PrevisaoHora[] {
  return hourly.time
    .flatMap((hora, i): PrevisaoHora[] => {
      const temperatura = hourly.apparent_temperature[i]
      if (temperatura === undefined) return []
      return [
        {
          hora,
          temperatura_aparente: temperatura,
          prob_chuva: hourly.precipitation_probability[i] ?? 0,
        },
      ]
    })
    .filter((previsao) => horaDe(previsao.hora) > horaDe(atual))
    .slice(0, HORAS_PROXIMAS)
}

function climaDe(resposta: Resposta): Clima {
  return {
    temperatura_aparente: resposta.current.apparent_temperature,
    umidade: resposta.current.relative_humidity_2m,
    observado_em: resposta.current.time,
    proximas_horas: proximasDe(resposta.hourly, resposta.current.time),
  }
}

async function consultar(busca: typeof fetch, url: string): Promise<unknown> {
  const resposta = await busca(url, { signal: AbortSignal.timeout(clima.timeoutMs) })
  if (resposta.status !== 200) throw new Error(`Open-Meteo respondeu ${resposta.status}`)
  return resposta.json()
}

function urlDe(c: Coordenadas): string {
  const query = new URLSearchParams({
    latitude: String(arredondar(c.lat)),
    longitude: String(arredondar(c.lon)),
    current: "apparent_temperature,relative_humidity_2m",
    hourly: "apparent_temperature,precipitation_probability",
    forecast_hours: "7",
    timezone: "auto",
  })
  return `${URL_PREVISAO}?${query.toString()}`
}

export function createOpenMeteoWeather(deps?: { fetch?: typeof fetch }): WeatherSource {
  return {
    async buscar(c: Coordenadas): Promise<Clima> {
      const busca = deps?.fetch ?? globalThis.fetch
      let corpo: unknown
      try {
        corpo = await consultar(busca, urlDe(c))
      } catch {
        throw new WeatherUnavailableError()
      }
      const resultado = respostaSchema.safeParse(corpo)
      if (!resultado.success) throw new WeatherUnavailableError()
      return climaDe(resultado.data)
    },
  }
}
