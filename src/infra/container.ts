import { type AppConfig, config } from "@config/index"
import type { Clock } from "@/core/clock"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { DadosDaBase } from "@/core/knowledge/schemas"
import { createCachedWeatherSource } from "@/core/weather/cache"
import type { CityLookup, WeatherSource } from "@/core/weather/ports"
import { createDbClient, type DbClient } from "@/infra/db/client"
import { migrate } from "@/infra/db/migrate"
import { loadKnowledgeBase, readDadosDaBase } from "@/infra/knowledge/yaml-knowledge"
import { createOpenMeteoCities } from "@/infra/open-meteo/cities"
import { createOpenMeteoWeather } from "@/infra/open-meteo/weather"
import { systemClock } from "@/infra/system-clock"

export type Container = {
  config: AppConfig
  clock: Clock
  knowledge: KnowledgeBase
  weather: WeatherSource
  cities: CityLookup
}

// Leitura crua de data/ para scripts (sem validar): o script valida com validarBase.
export function readKnowledgeData(dir?: string): DadosDaBase {
  return readDadosDaBase(dir)
}

export function createContainer(overrides?: Partial<Container>): Container {
  const clock = overrides?.clock ?? systemClock
  let knowledge: KnowledgeBase | undefined
  let weather: WeatherSource | undefined
  let cities: CityLookup | undefined
  return {
    config,
    clock,
    // Carregada na primeira leitura e guardada: importar ou criar o container não toca em data/.
    get knowledge() {
      knowledge ??= loadKnowledgeBase()
      return knowledge
    },
    // Criadas na primeira leitura: criar o container não abre rede.
    get weather() {
      weather ??= createCachedWeatherSource(createOpenMeteoWeather(), clock)
      return weather
    },
    get cities() {
      cities ??= createOpenMeteoCities()
      return cities
    },
    ...overrides,
  }
}

let instance: Container | undefined

export function getContainer(): Container {
  instance ??= createContainer()
  return instance
}

// Cliente do banco criado na primeira migração: importar o container não lê DATABASE_URL.
let banco: DbClient | undefined

// Aplica as migrações pendentes de db/migrations/ e devolve os nomes aplicados agora.
export async function migrateDatabase(): Promise<string[]> {
  banco ??= createDbClient()
  return migrate(banco.sql, getContainer().clock)
}

// Fecha a conexão aberta pelos scripts, se houver, para o processo poder terminar.
export async function closeDatabase(): Promise<void> {
  const atual = banco
  banco = undefined
  await atual?.close()
}
