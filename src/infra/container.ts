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
import { type ComoFicouNaTela, visaoComoFicou } from "@/core/outcomes/visao"
import { lerCasa as lerCasaDoCore } from "@/core/pantry/ler"
import type { CasaNaTela } from "@/core/pantry/visao"
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
import { createRelogioE2e } from "@/infra/e2e/relogio"
import { optionalEnv, requireEnv } from "@/infra/env"
import { createFakeCities } from "@/infra/fakes/fake-cities"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
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
  lerCasa(contaId: string): Promise<CasaNaTela>
  lerComoFicou(contaId: string): Promise<ComoFicouNaTela>
  iniciarTelemetria(): Promise<void>
  encerrar(): Promise<void>
}

// Cliente do banco: criado na primeira vez que alguém precisa dele. Importar o container não lê DATABASE_URL.
let banco: DbClient | undefined

function bancoPreguicoso(): DbClient {
  banco ??= createDbClient()
  return banco
}

// Modo e2e: clima fixo, Intérprete e Acompanhante roteirizados. Os módulos entram por import dinâmico,
// na primeira chamada, para ficarem fora do caminho de produção.
function climaFixoE2e(): WeatherSource {
  return {
    async buscar(coordenadas) {
      const { createClimaFixo } = await import("@/infra/e2e/clima")
      return createClimaFixo().buscar(coordenadas)
    },
  }
}

// Um ledger por `x-ritu-e2e`, como os dados de cada teste.
function ledgerE2e(clock: Clock): UsageLedger {
  const porEscopo = new Map<string, UsageLedger>()
  const atual = async (): Promise<UsageLedger> => {
    const { createLedgerE2e, escopoDoPedidoNext } = await import("@/infra/e2e/cota")
    let ledger = porEscopo.get("e2e")
    if (!ledger) {
      ledger = createLedgerE2e(clock, escopoDoPedidoNext)
      porEscopo.set("e2e", ledger)
    }
    return ledger
  }
  return {
    reservar: async (m, l) => (await atual()).reservar(m, l),
    registrarTokens: async (m, t) => (await atual()).registrarTokens(m, t),
    registrarRateLimit: async (m) => (await atual()).registrarRateLimit(m),
    uso: async () => (await atual()).uso(),
    apagarAntigas: async () => (await atual()).apagarAntigas(),
  }
}

// O header `x-ritu-e2e-cota: esgotada` tira a cota do dia daquele pedido. Só no modo e2e.
function routerE2e(puro: ModelRouter): ModelRouter {
  const embrulhado = async (): Promise<ModelRouter> => {
    const { createRouterE2e, cotaEsgotadaNoPedidoNext } = await import("@/infra/e2e/cota")
    return createRouterE2e(puro, cotaEsgotadaNoPedidoNext)
  }
  return {
    paraPapel: (papel, opts) => puro.paraPapel(papel, opts),
    temModelo: async (papel) => (await embrulhado()).temModelo(papel),
    cotaDoDiaEsgotada: async (papel) => (await embrulhado()).cotaDoDiaEsgotada(papel),
  }
}

function routerDoModo(puro: ModelRouter, e2e: boolean): ModelRouter {
  return e2e ? routerE2e(puro) : puro
}

function llmE2e(): LlmClient {
  return {
    async gerar(pedido) {
      const { createLlmDeRoteiros } = await import("@/infra/e2e/roteiros")
      return createLlmDeRoteiros().gerar(pedido)
    },
  }
}

function runtimeE2e(): AgentRuntime {
  return {
    async passo(pedido) {
      const { createRuntimeDeRoteiros } = await import("@/infra/e2e/roteiros")
      return createRuntimeDeRoteiros().passo(pedido)
    },
  }
}

// Leitura crua de data/ para scripts (sem validar): o script valida com validarBase.
export function readKnowledgeData(dir?: string): DadosDaBase {
  return readDadosDaBase(dir)
}

export function readDemoSeed(dir?: string): DemoSeed {
  return loadDemoSeed(dir)
}

export function createContainer(overrides?: Partial<Container>): Container {
  const e2e = optionalEnv("RITU_MODO") === "e2e"
  // No modo e2e, a hora local fica à noite, para o E2E não depender da hora em que roda.
  const clock = overrides?.clock ?? (e2e ? createRelogioE2e(systemClock) : systemClock)
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
      weather ??= createCachedWeatherSource(
        e2e ? climaFixoE2e() : createOpenMeteoWeather(),
        clock,
        container.telemetry,
      )
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
      ledger ??= e2e ? ledgerE2e(clock) : createPgUsageLedger(bancoPreguicoso().sql, clock)
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
      router ??= routerDoModo(
        createModelRouter({ ledger: container.ledger, clock, telemetry: container.telemetry }),
        e2e,
      )
      return router
    },
    // A chave do Gemini só é lida na primeira chamada.
    get llm() {
      llm ??= e2e ? llmE2e() : createGeminiClient({ apiKey: () => requireEnv("GEMINI_API_KEY") })
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
      runtime ??= e2e
        ? runtimeE2e()
        : createMastraRuntime({ apiKey: () => requireEnv("GEMINI_API_KEY") })
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
    // Telas de Minha casa e Como ficou: o fuso vem do perfil, com o padrão quando a pessoa não escolheu cidade.
    async lerCasa(contaId) {
      return lerCasaDoCore(
        { stores: container.stores, kb: container.knowledge, clock },
        contaId,
        await fusoDaConta(container, contaId),
      )
    },
    async lerComoFicou(contaId) {
      const retornos = await container.stores.outcomes.pendentes(contaId)
      return visaoComoFicou({
        retornos,
        kb: container.knowledge,
        agora: clock.now(),
        fuso: await fusoDaConta(container, contaId),
      })
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

async function fusoDaConta(container: Container, contaId: string): Promise<string> {
  const perfil = await container.stores.profiles.ler(contaId)
  return perfil?.cidade_fuso ?? config.clima.fusoPadrao
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
