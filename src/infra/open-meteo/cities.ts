import { clima } from "@config/clima"
import { z } from "zod"
import { type Cidade, type CityLookup, CityLookupUnavailableError } from "@/core/weather/ports"

const URL_BUSCA = "https://geocoding-api.open-meteo.com/v1/search"

const respostaSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        admin1: z.string().optional(),
        country: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        timezone: z.string(),
      }),
    )
    .optional(),
})

type Item = NonNullable<z.infer<typeof respostaSchema>["results"]>[number]

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100
}

function cidadeDe(item: Item): Cidade {
  const cidade: Cidade = {
    nome: item.name,
    pais: item.country,
    lat: arredondar(item.latitude),
    lon: arredondar(item.longitude),
    fuso: item.timezone,
  }
  if (item.admin1) cidade.regiao = item.admin1
  return cidade
}

async function consultar(busca: typeof fetch, nome: string): Promise<unknown> {
  const query = new URLSearchParams({
    name: nome,
    count: String(clima.busca.maximoResultados),
    language: clima.busca.idioma,
    format: "json",
  })
  const resposta = await busca(`${URL_BUSCA}?${query.toString()}`, {
    signal: AbortSignal.timeout(clima.timeoutMs),
  })
  if (resposta.status !== 200) throw new Error(`Open-Meteo respondeu ${resposta.status}`)
  return resposta.json()
}

export function createOpenMeteoCities(deps?: { fetch?: typeof fetch }): CityLookup {
  return {
    async buscar(nomeDigitado: string): Promise<Cidade[]> {
      const nome = nomeDigitado.trim()
      if (nome.length < clima.busca.minimoCaracteres) return []
      const busca = deps?.fetch ?? globalThis.fetch
      let corpo: unknown
      try {
        corpo = await consultar(busca, nome)
      } catch {
        throw new CityLookupUnavailableError()
      }
      const resultado = respostaSchema.safeParse(corpo)
      if (!resultado.success) throw new CityLookupUnavailableError()
      return (resultado.data.results ?? []).slice(0, clima.busca.maximoResultados).map(cidadeDe)
    },
  }
}
