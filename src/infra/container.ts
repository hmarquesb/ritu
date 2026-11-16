import { type AppConfig, config } from "@config/index"
import { createCompanion } from "@/core/agents/companion/responder"
import { createInterpreter } from "@/core/agents/interpreter/interpretar"
import { createJudge, type Judge } from "@/core/agents/judge/julgar"
import { createMemoryAgent, type MemoryAgent } from "@/core/agents/memory/memoria"
import type { Clock } from "@/core/clock"
import { createConversation } from "@/core/conversation/conversar"
import type { DemoSeed } from "@/core/demo-seed"
import { RituError } from "@/core/errors"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { DadosDaBase } from "@/core/knowledge/schemas"
import type { UsageLimiter } from "@/core/limits/ports"
import type { LlmClient } from "@/core/llm/client"
import type { UsageLedger } from "@/core/llm/ledger"
import { createModelRouter, type ModelRouter } from "@/core/llm/router"
import { createPatterns } from "@/core/patterns"
import { createRoutine } from "@/core/routine"
import type { AgentRuntime } from "@/core/runs/agent-runtime"
import { createRunService } from "@/core/runs/run-service"
import type { Stores, Transactor } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"
import { createTouches } from "@/core/touches"
import { createCachedWeatherSource } from "@/core/weather/cache"
import type { CityLookup, WeatherSource } from "@/core/weather/ports"
import { createDbClient, type DbClient } from "@/infra/db/client"
import { createPgLimiter } from "@/infra/db/limits"
import { migrate } from "@/infra/db/migrate"
import { createPgStores } from "@/infra/db/stores"
import { createPgTransactor } from "@/infra/db/transactor"
import { createPgUsageLedger } from "@/infra/db/usage-ledger"
import { optionalEnv, requireEnv } from "@/infra/env"
import { createFakeCities } from "@/infra/fakes/fake-cities"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryLedger, createMemoryStores } from "@/infra/fakes/memory-stores"
import { createGeminiClient } from "@/infra/gemini/client"
import { loadKnowledgeBase, readDadosDaBase } from "@/infra/knowledge/yaml-knowledge"
import { loadDemoSeed } from "@/infra/knowledge/yaml-seed"
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
  limiter: UsageLimiter
  demoSeed: DemoSeed
  router: ModelRouter
  llm: LlmClient
  telemetry: Telemetry
  runtime: AgentRuntime
  runs: ReturnType<typeof createRunService>
  companion: ReturnType<typeof createCompanion>
  interpreter: ReturnType<typeof createInterpreter>
  judge: Judge
  memory: MemoryAgent
  conversation: ReturnType<typeof createConversation>
  touches: ReturnType<typeof createTouches>
  routine: ReturnType<typeof createRoutine>
  patterns: ReturnType<typeof createPatterns>
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

export function readDemoSeed(dir?: string): DemoSeed {
  return loadDemoSeed(dir)
}

export function createContainer(overrides?: Partial<Container>): Container {
  const clock = overrides?.clock ?? systemClock
  const e2e = optionalEnv("RITU_MODO") === "e2e"
  if (e2e && optionalEnv("VERCEL_ENV") === "production") {
    throw new RituError("modo_e2e_em_producao", "RITU_MODO=e2e não pode rodar em produção")
  }
  // Modo de E2E: tudo em memória, sem banco nem rede.
  const memoria = e2e
    ? createMemoryStores(clock, {
        alimentoExiste: (id) => Boolean(container.knowledge.alimento(id)),
      })
    : undefined
  let limiter: UsageLimiter | undefined
  let demoSeed: DemoSeed | undefined
  let knowledge: KnowledgeBase | undefined
  let weather: WeatherSource | undefined
  let cities: CityLookup | undefined
  let stores: Stores | undefined
  let tx: Transactor | undefined
  let ledger: UsageLedger | undefined
  let router: ModelRouter | undefined
  let llm: LlmClient | undefined
  let telemetry: Telemetry | undefined
  let runtime: AgentRuntime | undefined
  let runs: ReturnType<typeof createRunService> | undefined
  let companion: ReturnType<typeof createCompanion> | undefined
  let interpreter: ReturnType<typeof createInterpreter> | undefined
  let judge: Judge | undefined
  let memory: MemoryAgent | undefined
  let conversation: ReturnType<typeof createConversation> | undefined
  let touches: ReturnType<typeof createTouches> | undefined
  let routine: ReturnType<typeof createRoutine> | undefined
  let patterns: ReturnType<typeof createPatterns> | undefined
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
      cities ??= e2e ? createFakeCities() : createOpenMeteoCities()
      return cities
    },
    // Adaptadores Postgres: a conexão só abre na primeira consulta. Alimento desconhecido vira nome livre.
    get stores() {
      if (memoria) return memoria
      stores ??= createPgStores(bancoPreguicoso().sql, clock, {
        alimentoExiste: (id) => Boolean(container.knowledge.alimento(id)),
      })
      return stores
    },
    get tx() {
      if (memoria) return memoria
      tx ??= createPgTransactor(bancoPreguicoso().sql, clock, {
        alimentoExiste: (id) => Boolean(container.knowledge.alimento(id)),
      })
      return tx
    },
    get ledger() {
      ledger ??= e2e ? createMemoryLedger(clock) : createPgUsageLedger(bancoPreguicoso().sql, clock)
      return ledger
    },
    get limiter() {
      limiter ??= e2e ? createMemoryLimiter() : createPgLimiter(bancoPreguicoso().sql)
      return limiter
    },
    // Carregado na primeira leitura: criar o container não toca em seed/.
    get demoSeed() {
      demoSeed ??= loadDemoSeed()
      return demoSeed
    },
    get router() {
      router ??= createModelRouter({
        ledger: container.ledger,
        clock,
        telemetry: container.telemetry,
      })
      return router
    },
    // A chave do Gemini só é lida na primeira chamada.
    get llm() {
      llm ??= createGeminiClient({ apiKey: () => requireEnv("GEMINI_API_KEY") })
      return llm
    },
    // OTel só com endpoint; sem ele, a telemetria nula. O SDK de Node não entra por aqui.
    get telemetry() {
      telemetry ??=
        e2e || optionalEnv("OTEL_EXPORTER_OTLP_ENDPOINT") === undefined
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
    get companion() {
      companion ??= createCompanion({
        stores: container.stores,
        tx: container.tx,
        kb: container.knowledge,
        clock,
        weather: container.weather,
        router: container.router,
        runs: container.runs,
        telemetry: container.telemetry,
        judge: container.judge,
      })
      return companion
    },
    get interpreter() {
      interpreter ??= createInterpreter({
        router: container.router,
        client: container.llm,
        kb: container.knowledge,
        telemetry: container.telemetry,
        clock,
      })
      return interpreter
    },
    // O Juiz usa o mesmo cliente e o mesmo roteador do Acompanhante; a chamada só sai quando ele julga.
    get judge() {
      judge ??= createJudge({
        router: container.router,
        client: container.llm,
        kb: container.knowledge,
        telemetry: container.telemetry,
        clock,
      })
      return judge
    },
    get memory() {
      memory ??= createMemoryAgent({
        router: container.router,
        client: container.llm,
        kb: container.knowledge,
        telemetry: container.telemetry,
        clock,
      })
      return memory
    },
    get conversation() {
      conversation ??= createConversation({
        memory: container.memory,
        stores: container.stores,
        tx: container.tx,
        kb: container.knowledge,
        clock,
        telemetry: container.telemetry,
        runs: container.runs,
        interpreter: container.interpreter,
        companion: container.companion,
      })
      return conversation
    },
    // Os quatro toques da tela (retorno, gosto e troca): as deps são as do próprio container.
    get touches() {
      touches ??= createTouches({
        tx: container.tx,
        stores: container.stores,
        kb: container.knowledge,
        clock,
        telemetry: container.telemetry,
      })
      return touches
    },
    // Rotina e padrões: as deps são as do próprio container; nada disso abre o banco na criação.
    get routine() {
      routine ??= createRoutine({
        stores: container.stores,
        tx: container.tx,
        memory: container.memory,
        kb: container.knowledge,
        telemetry: container.telemetry,
      })
      return routine
    },
    get patterns() {
      patterns ??= createPatterns({
        stores: container.stores,
        kb: container.knowledge,
        clock,
        telemetry: container.telemetry,
      })
      return patterns
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

type ComE2e = typeof globalThis & { __rituContainerE2e?: Container }

export function getContainer(): Container {
  if (optionalEnv("RITU_MODO") === "e2e") {
    // O Next carrega módulos em separado: os stores em memória vivem no globalThis.
    const global = globalThis as ComE2e
    global.__rituContainerE2e ??= createContainer()
    return global.__rituContainerE2e
  }
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
