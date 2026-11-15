import { describe, expect, it } from "vitest"
import { z } from "zod"
import { filtroVazio } from "@/core/knowledge/filtros"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import { createCachedWeatherSource } from "@/core/weather/cache"
import type { CidadeDaPessoa, Clima, PrevisaoHora, WeatherSource } from "@/core/weather/ports"
import { climaEmQualidades } from "@/core/weather/qualidades"
import { tendenciaDasProximasHoras } from "@/core/weather/tendencia"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { climaAgoraTool, climaProximasHorasTool, climaTools } from "./clima"
import type { Tool, ToolContext } from "./tool"

const RIO: CidadeDaPessoa = {
  nome: "Rio de Janeiro",
  lat: -22.91,
  lon: -43.17,
  fuso: "America/Sao_Paulo",
}

function ctx(fonte: WeatherSource, cidade?: CidadeDaPessoa): ToolContext {
  return {
    kb: createMiniKnowledge(),
    filtro: filtroVazio,
    sinais: sinaisVazios,
    clima: cidade ? { fonte, cidade } : { fonte },
    contaId: "conta-1",
    stores: createMemoryStores(createFixedClock("2026-01-15T12:00:00Z")),
    clock: createFixedClock("2026-01-15T12:00:00Z"),
  }
}

// Seis horas a partir da próxima, com a hora em ISO (-03:00).
function horas(temperaturas: number[], probsChuva: number[] = temperaturas.map(() => 0)) {
  return temperaturas.map<PrevisaoHora>((temperatura_aparente, i) => ({
    hora: `2026-01-15T${String(13 + i).padStart(2, "0")}:00:00-03:00`,
    temperatura_aparente,
    prob_chuva: probsChuva[i] ?? 0,
  }))
}

const SEM_CIDADE = { status: "sem_cidade" }
const INDISPONIVEL = { status: "indisponivel" }

describe("clima.agora", () => {
  it("sem cidade devolve sem_cidade e não chama a porta", async () => {
    const fake = createFakeWeather()

    const r = await climaAgoraTool.execute({}, ctx(fake))

    expect(r).toEqual(SEM_CIDADE)
    expect(fake.chamadas).toBe(0)
  })

  it("porta fora do ar devolve indisponivel", async () => {
    const fake = createFakeWeather()
    fake.foraDoAr(true)

    expect(await climaAgoraTool.execute({}, ctx(fake, RIO))).toEqual(INDISPONIVEL)
  })

  it("porta que lança um erro qualquer devolve indisponivel, sem lançar", async () => {
    const porta: WeatherSource = {
      buscar: async () => {
        throw new Error("falha qualquer")
      },
    }

    expect(await climaAgoraTool.execute({}, ctx(porta, RIO))).toEqual(INDISPONIVEL)
  })

  it("arredonda temperatura para uma casa e umidade para inteiro", async () => {
    const fake = createFakeWeather({ temperatura_aparente: 24.37, umidade: 60.6 })

    const r = await climaAgoraTool.execute({}, ctx(fake, RIO))

    expect(r).toMatchObject({
      status: "ok",
      cidade: "Rio de Janeiro",
      temperatura_aparente: 24.4,
      umidade: 61,
      faixa_temperatura: "neutro",
      faixa_umidade: "neutro",
      gunas: [],
    })
  })

  it("traz as mesmas gunas de climaEmQualidades", async () => {
    const dados: Clima = {
      temperatura_aparente: 15,
      umidade: 80,
      observado_em: "2026-01-15T12:00:00-03:00",
      proximas_horas: [],
    }
    const fake = createFakeWeather(dados)

    const r = await climaAgoraTool.execute({}, ctx(fake, RIO))

    expect(r).toEqual({
      status: "ok",
      cidade: "Rio de Janeiro",
      temperatura_aparente: 15,
      umidade: 80,
      ...climaEmQualidades(dados),
      observado_em: "2026-01-15T12:00:00-03:00",
    })
    expect(r).toMatchObject({ gunas: ["frio", "oleoso"] })
  })
})

describe("clima.proximas_horas", () => {
  it("sem cidade devolve sem_cidade e não chama a porta", async () => {
    const fake = createFakeWeather()

    expect(await climaProximasHorasTool.execute({}, ctx(fake))).toEqual(SEM_CIDADE)
    expect(fake.chamadas).toBe(0)
  })

  it("porta fora do ar e erro qualquer devolvem indisponivel", async () => {
    const fake = createFakeWeather()
    fake.foraDoAr(true)
    const porta: WeatherSource = {
      buscar: async () => {
        throw new TypeError("quebrou")
      },
    }

    expect(await climaProximasHorasTool.execute({}, ctx(fake, RIO))).toEqual(INDISPONIVEL)
    expect(await climaProximasHorasTool.execute({}, ctx(porta, RIO))).toEqual(INDISPONIVEL)
  })

  it("esquentando com chuva: traz a tendência de tendenciaDasProximasHoras", async () => {
    const dados: Clima = {
      temperatura_aparente: 24,
      umidade: 60,
      observado_em: "2026-01-15T12:00:00-03:00",
      proximas_horas: horas([24, 24, 24, 24, 24, 27.5], [0, 0, 0, 0, 0, 50]),
    }
    const fake = createFakeWeather(dados)

    const r = await climaProximasHorasTool.execute({}, ctx(fake, RIO))

    expect(r).toEqual({
      status: "ok",
      cidade: "Rio de Janeiro",
      ...tendenciaDasProximasHoras(dados),
    })
    expect(r).toEqual({
      status: "ok",
      cidade: "Rio de Janeiro",
      temperatura: "esquenta",
      chuva: true,
      ate: "2026-01-15T18:00:00-03:00",
    })
  })

  it("esfriando sem chuva", async () => {
    const fake = createFakeWeather({
      temperatura_aparente: 24,
      proximas_horas: horas([23, 22, 21, 21, 21, 20.9]),
    })

    const r = await climaProximasHorasTool.execute({}, ctx(fake, RIO))

    expect(r).toMatchObject({ temperatura: "esfria", chuva: false })
  })

  it("sem próximas horas devolve estavel, sem chuva, até o momento observado", async () => {
    const fake = createFakeWeather({ proximas_horas: [] })

    expect(await climaProximasHorasTool.execute({}, ctx(fake, RIO))).toEqual({
      status: "ok",
      cidade: "Rio de Janeiro",
      temperatura: "estavel",
      chuva: false,
      ate: "2026-01-15T12:00:00-03:00",
    })
  })
})

describe("cache e tools", () => {
  it("as duas tools para a mesma cidade, com a fonte em cache, chamam a porta uma vez", async () => {
    const fake = createFakeWeather()
    const fonte = createCachedWeatherSource(fake, createFixedClock("2026-01-15T12:00:00Z"))
    const c = ctx(fonte, RIO)

    await climaAgoraTool.execute({}, c)
    await climaProximasHorasTool.execute({}, c)

    expect(fake.chamadas).toBe(1)
  })

  it("entrada com campos extras é rejeitada com erro de zod", async () => {
    const fake = createFakeWeather()

    // Como o agente recebe a tool: genérica, com entrada não tipada.
    const generica: Tool<unknown, unknown> = climaAgoraTool

    await expect(generica.execute({ extra: 1 }, ctx(fake, RIO))).rejects.toBeInstanceOf(z.ZodError)
  })

  it("exporta as duas tools com nomes em português", () => {
    expect(climaTools.map((t) => t.name)).toEqual(["clima.agora", "clima.proximas_horas"])
  })
})
