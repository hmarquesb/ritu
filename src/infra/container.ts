import { type AppConfig, config } from "@config/index"
import type { Clock } from "@/core/clock"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { DadosDaBase } from "@/core/knowledge/schemas"
import type { Stores, Transactor } from "@/core/stores"
import { createCachedWeatherSource } from "@/core/weather/cache"
import type { CityLookup, WeatherSource } from "@/core/weather/ports"
import { createDbClient, type DbClient } from "@/infra/db/client"
import { migrate } from "@/infra/db/migrate"
import { createPgStores } from "@/infra/db/stores"
import { createPgTransactor } from "@/infra/db/transactor"
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
  stores: Stores
  tx: Transactor
}

// Cliente do banco: criado na primeira vez que alguém precisa dele. Importar o container não lê DATABASE_URL.
let banco: DbClient | undefined

function bancoPreguicoso(): DbClient {
  banco ??= createDbClient()
  return banco
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
  let stores: Stores | undefined
  let tx: Transactor | undefined
  const container: Container = {
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
    // Adaptadores Postgres: a conexão só abre na primeira consulta. Alimento desconhecido vira nome livre.
    get stores() {
      stores ??= createPgStores(bancoPreguicoso().sql, clock, {
        alimentoExiste: (id) => Boolean(container.knowledge.alimento(id)),
      })
      return stores
    },
    get tx() {
      tx ??= createPgTransactor(bancoPreguicoso().sql, clock, {
        alimentoExiste: (id) => Boolean(container.knowledge.alimento(id)),
      })
      return tx
    },
    ...overrides,
  }
  return container
}

let instance: Container | undefined

export function getContainer(): Container {
  instance ??= createContainer()
  return instance
}

// Aplica as migrações pendentes de db/migrations/ e devolve os nomes aplicados agora.
export async function migrateDatabase(): Promise<string[]> {
  return migrate(bancoPreguicoso().sql, getContainer().clock)
}

// Fecha a conexão aberta pelos scripts, se houver, para o processo poder terminar.
export async function closeDatabase(): Promise<void> {
  const atual = banco
  banco = undefined
  await atual?.close()
}
