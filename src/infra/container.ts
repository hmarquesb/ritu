import { type AppConfig, config } from "@config/index"
import type { Clock } from "@/core/clock"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { DadosDaBase } from "@/core/knowledge/schemas"
import type { UsageLedger } from "@/core/llm/ledger"
import type { AgentRuntime } from "@/core/runs/agent-runtime"
import { createRunService } from "@/core/runs/run-service"
import type { Stores, Transactor } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"
import { createCachedWeatherSource } from "@/core/weather/cache"
import type { CityLookup, WeatherSource } from "@/core/weather/ports"
import { createDbClient, type DbClient } from "@/infra/db/client"
import { migrate } from "@/infra/db/migrate"
import { createPgStores } from "@/infra/db/stores"
import { createPgTransactor } from "@/infra/db/transactor"
import { createPgUsageLedger } from "@/infra/db/usage-ledger"
import { optionalEnv, requireEnv } from "@/infra/env"
import { loadKnowledgeBase, readDadosDaBase } from "@/infra/knowledge/yaml-knowledge"
import { createMastraRuntime } from "@/infra/mastra/runtime"
import { createOpenMeteoCities } from "@/infra/open-meteo/cities"
import { createOpenMeteoWeather } from "@/infra/open-meteo/weather"
import { createNullTelemetry } from "@/infra/otel/null-telemetry"
import { createOtelTelemetry } from "@/infra/otel/telemetry"
import { systemClock } from "@/infra/system-clock"

export type Container = {
  config: AppConfig
  clock: Clock
  knowledge: KnowledgeBase
  weather: WeatherSource
  cities: CityLookup
  stores: Stores
  tx: Transactor
  ledger: UsageLedger
  telemetry: Telemetry
  runtime: AgentRuntime
  runs: ReturnType<typeof createRunService>
  iniciarTelemetria(): Promise<void>
  encerrar(): Promise<void>
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
  let ledger: UsageLedger | undefined
  let telemetry: Telemetry | undefined
  let runtime: AgentRuntime | undefined
  let runs: ReturnType<typeof createRunService> | undefined
  let sdk: { encerrar(): Promise<void> } | undefined
  let telemetriaIniciada = false
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
    get ledger() {
      ledger ??= createPgUsageLedger(bancoPreguicoso().sql, clock)
      return ledger
    },
    // OTel só com endpoint; sem ele, a telemetria nula. O SDK de Node não entra por aqui.
    get telemetry() {
      telemetry ??=
        optionalEnv("OTEL_EXPORTER_OTLP_ENDPOINT") === undefined
          ? createNullTelemetry()
          : createOtelTelemetry()
      return telemetry
    },
    // A chave do modelo só é lida na primeira chamada de passo.
    get runtime() {
      runtime ??= createMastraRuntime({ apiKey: () => requireEnv("GEMINI_API_KEY") })
      return runtime
    },
    get runs() {
      runs ??= createRunService({
        stores: container.stores,
        tx: container.tx,
        runtime: container.runtime,
        clock,
        telemetry: container.telemetry,
      })
      return runs
    },
    // SDK de Node para scripts: só com endpoint e fora do Next (lá quem registra é instrumentation.ts).
    async iniciarTelemetria() {
      if (telemetriaIniciada) return
      if (optionalEnv("OTEL_EXPORTER_OTLP_ENDPOINT") === undefined) return
      if (process.env.NEXT_RUNTIME !== undefined) return
      telemetriaIniciada = true
      const { iniciarOtelNode } = await import("@/infra/otel/node-sdk")
      sdk = iniciarOtelNode()
    },
    async encerrar() {
      await container.telemetry.encerrar()
      await sdk?.encerrar()
      sdk = undefined
      await closeDatabase()
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
