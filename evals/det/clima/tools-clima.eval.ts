import { describe, expect, it } from "vitest"
import { climaAgoraTool, climaProximasHorasTool } from "@/core/agents/tools/clima"
import { filtroVazio } from "@/core/knowledge/filtros"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import type { ToolContext } from "@/core/tools/tool"
import type { CidadeDaPessoa, WeatherSource } from "@/core/weather/ports"
import { climaEmQualidades } from "@/core/weather/qualidades"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"

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

describe("clima.agora", () => {
  it("ok: devolve cidade, temperatura, umidade e as mesmas gunas de climaEmQualidades", async () => {
    const fake = createFakeWeather({ temperatura_aparente: 28, umidade: 80 })

    const r = await climaAgoraTool.execute({}, ctx(fake, RIO))

    expect(r).toMatchObject({
      status: "ok",
      cidade: "Rio de Janeiro",
      temperatura_aparente: 28,
      umidade: 80,
    })
    const esperado = climaEmQualidades({ temperatura_aparente: 28, umidade: 80 })
    expect(r).toMatchObject({
      faixa_temperatura: esperado.faixa_temperatura,
      faixa_umidade: esperado.faixa_umidade,
      gunas: esperado.gunas,
    })
  })

  it("sem_cidade: sem cidade da pessoa não consulta o clima", async () => {
    const fake = createFakeWeather()

    const r = await climaAgoraTool.execute({}, ctx(fake))

    expect(r).toEqual({ status: "sem_cidade" })
    expect(fake.chamadas).toBe(0)
  })

  it("indisponivel: falha da fonte vira status, sem lançar", async () => {
    const fake = createFakeWeather()
    fake.foraDoAr(true)

    const r = await climaAgoraTool.execute({}, ctx(fake, RIO))

    expect(r).toEqual({ status: "indisponivel" })
  })
})

describe("clima.proximas_horas", () => {
  it("ok: devolve cidade, temperatura, chuva e ate", async () => {
    const fake = createFakeWeather({
      temperatura_aparente: 24,
      proximas_horas: [
        {
          hora: "2026-01-15T13:00:00-03:00",
          temperatura_aparente: 25,
          prob_chuva: 0,
        },
        {
          hora: "2026-01-15T14:00:00-03:00",
          temperatura_aparente: 29,
          prob_chuva: 70,
        },
      ],
    })

    const r = await climaProximasHorasTool.execute({}, ctx(fake, RIO))

    expect(r).toEqual({
      status: "ok",
      cidade: "Rio de Janeiro",
      temperatura: "esquenta",
      chuva: true,
      ate: "2026-01-15T14:00:00-03:00",
    })
  })

  it("sem_cidade: sem cidade da pessoa não consulta o clima", async () => {
    const fake = createFakeWeather()

    const r = await climaProximasHorasTool.execute({}, ctx(fake))

    expect(r).toEqual({ status: "sem_cidade" })
    expect(fake.chamadas).toBe(0)
  })

  it("indisponivel: falha da fonte vira status, sem lançar", async () => {
    const fake = createFakeWeather()
    fake.foraDoAr(true)

    const r = await climaProximasHorasTool.execute({}, ctx(fake, RIO))

    expect(r).toEqual({ status: "indisponivel" })
  })
})
