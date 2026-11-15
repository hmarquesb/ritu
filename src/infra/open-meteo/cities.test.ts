import { describe, expect, it, vi } from "vitest"
import { CityLookupUnavailableError } from "@/core/weather/ports"
import { createOpenMeteoCities } from "./cities"

const CORPO_RIO = {
  results: [
    {
      name: "Rio de Janeiro",
      admin1: "Rio de Janeiro",
      country: "Brasil",
      latitude: -22.9068467,
      longitude: -43.1728965,
      timezone: "America/Sao_Paulo",
    },
    {
      name: "Rio Grande",
      country: "Brasil",
      latitude: -32.0349,
      longitude: -52.0986,
      timezone: "America/Sao_Paulo",
    },
  ],
}

function fetchFalso(corpo: unknown, status = 200) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(corpo), { status }))
}

function urlChamada(mock: ReturnType<typeof fetchFalso>): URL {
  return new URL(String(mock.mock.calls[0]?.[0]))
}

describe("createOpenMeteoCities", () => {
  it("busca pelo nome e mapeia os campos com coordenadas de duas casas", async () => {
    const mock = fetchFalso(CORPO_RIO)

    const cidades = await createOpenMeteoCities({ fetch: mock }).buscar("rio")

    expect(cidades[0]).toEqual({
      nome: "Rio de Janeiro",
      regiao: "Rio de Janeiro",
      pais: "Brasil",
      lat: -22.91,
      lon: -43.17,
      fuso: "America/Sao_Paulo",
    })
    expect(cidades[1]).toEqual({
      nome: "Rio Grande",
      pais: "Brasil",
      lat: -32.03,
      lon: -52.1,
      fuso: "America/Sao_Paulo",
    })
    expect(cidades[1]).not.toHaveProperty("regiao")
  })

  it("chama o geocoding com os parâmetros do contrato", async () => {
    const mock = fetchFalso(CORPO_RIO)

    await createOpenMeteoCities({ fetch: mock }).buscar("rio")

    const url = urlChamada(mock)
    expect(url.origin + url.pathname).toBe("https://geocoding-api.open-meteo.com/v1/search")
    expect(url.searchParams.get("name")).toBe("rio")
    expect(url.searchParams.get("count")).toBe("5")
    expect(url.searchParams.get("language")).toBe("pt")
    expect(url.searchParams.get("format")).toBe("json")
  })

  it("não chama a rede para texto com menos de dois caracteres", async () => {
    const mock = fetchFalso(CORPO_RIO)
    const adaptador = createOpenMeteoCities({ fetch: mock })

    await expect(adaptador.buscar("r")).resolves.toEqual([])
    await expect(adaptador.buscar("  ")).resolves.toEqual([])
    expect(mock).not.toHaveBeenCalled()
  })

  it("tira espaços das pontas e codifica o nome", async () => {
    const mock = fetchFalso({ results: [] })

    await createOpenMeteoCities({ fetch: mock }).buscar("  São Paulo ")

    const url = urlChamada(mock)
    expect(url.searchParams.get("name")).toBe("São Paulo")
    expect(url.search).toContain("name=S%C3%A3o+Paulo")
  })

  it("devolve lista vazia quando não há results", async () => {
    const cidades = await createOpenMeteoCities({ fetch: fetchFalso({}) }).buscar("zzzz")

    expect(cidades).toEqual([])
  })

  it("devolve no máximo 5 cidades", async () => {
    const item = CORPO_RIO.results[0]
    const muitas = { results: Array.from({ length: 8 }, () => item) }

    const cidades = await createOpenMeteoCities({ fetch: fetchFalso(muitas) }).buscar("rio")

    expect(cidades).toHaveLength(5)
  })

  it("lança CityLookupUnavailableError com status diferente de 200", async () => {
    const adaptador = createOpenMeteoCities({ fetch: fetchFalso({}, 500) })

    await expect(adaptador.buscar("rio")).rejects.toBeInstanceOf(CityLookupUnavailableError)
  })

  it("lança CityLookupUnavailableError quando o fetch falha", async () => {
    const mock = vi.fn<typeof fetch>(async () => {
      throw new DOMException("timeout", "TimeoutError")
    })

    await expect(createOpenMeteoCities({ fetch: mock }).buscar("rio")).rejects.toMatchObject({
      code: "cidades_indisponivel",
    })
  })

  it("lança CityLookupUnavailableError quando a resposta sai do schema", async () => {
    const adaptador = createOpenMeteoCities({ fetch: fetchFalso({ results: [{ name: 1 }] }) })

    await expect(adaptador.buscar("rio")).rejects.toBeInstanceOf(CityLookupUnavailableError)
  })
})
