import {
  type Clima,
  type Coordenadas,
  type WeatherSource,
  WeatherUnavailableError,
} from "@/core/weather/ports"

export type FakeWeather = WeatherSource & {
  set(c: Partial<Clima>): void
  foraDoAr(sim: boolean): void
  chamadas: number
}

const CLIMA_PADRAO: Clima = {
  temperatura_aparente: 24,
  umidade: 60,
  observado_em: "2026-01-15T12:00:00-03:00",
  proximas_horas: [
    "2026-01-15T13:00:00-03:00",
    "2026-01-15T14:00:00-03:00",
    "2026-01-15T15:00:00-03:00",
    "2026-01-15T16:00:00-03:00",
    "2026-01-15T17:00:00-03:00",
    "2026-01-15T18:00:00-03:00",
  ].map((hora) => ({ hora, temperatura_aparente: 24, prob_chuva: 0 })),
}

export function createFakeWeather(inicial: Partial<Clima> = {}): FakeWeather {
  let atual: Clima = { ...CLIMA_PADRAO, ...inicial }
  let foraDoAr = false

  const fake: FakeWeather = {
    chamadas: 0,
    set(c) {
      atual = { ...atual, ...c }
    },
    foraDoAr(sim) {
      foraDoAr = sim
    },
    async buscar(_c: Coordenadas) {
      fake.chamadas += 1
      if (foraDoAr) throw new WeatherUnavailableError()
      return atual
    },
  }

  return fake
}
