import { llmCotas, type Papel } from "@config/llm-cotas"
import type { createCompanion } from "@/core/agents/companion/responder"
import type { UsageLedger } from "@/core/llm/ledger"
import { createModelRouter, type ModelRouter } from "@/core/llm/router"
import type { AgentRuntime } from "@/core/runs/agent-runtime"
import type { createRunService } from "@/core/runs/run-service"
import type { Stores } from "@/core/stores"
import { diaLocal } from "@/core/time/dia-local"
import { createContainer } from "@/infra/container"
import { createFakeWeather, type FakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger, createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry, type MemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import type { Cenario } from "./tipos"

const DIA_EM_MS = 86_400_000

export type DepsDoCenario = {
  clock: ReturnType<typeof createFixedClock>
  stores: Stores
  telemetry: MemoryTelemetry
  ledger: UsageLedger
  router: ModelRouter
  weather: FakeWeather
  runtime: AgentRuntime
  runs: ReturnType<typeof createRunService>
  companion: ReturnType<typeof createCompanion>
}

export type OpcoesDoCenario = {
  runtime?: AgentRuntime
  // Esgota, no dia, só o modelo principal do papel (registrarRateLimit × rateLimitsParaEsgotarODia).
  esgotar?: Papel
}

const isoMenos = (iso: string, dias: number): string =>
  new Date(Date.parse(iso) - dias * DIA_EM_MS).toISOString()

async function esgotarModelos(ledger: UsageLedger, modelos: readonly string[]): Promise<void> {
  for (const modelo of modelos) {
    for (let i = 0; i < llmCotas.rateLimitsParaEsgotarODia; i++) {
      await ledger.registrarRateLimit(modelo)
    }
  }
}

async function aplicarPerfil(stores: Stores, contaId: string, c: Cenario): Promise<void> {
  const p = c.perfil
  if (p.prakriti) await stores.profiles.definirPrakriti(contaId, p.prakriti, "declarado")
  if (p.cidade) await stores.profiles.definirCidade(contaId, p.cidade)
  if (p.restricoes) await stores.profiles.definirRestricoes(contaId, p.restricoes)
  if (p.evitar_sempre) await stores.profiles.acrescentarEvitarSempre(contaId, p.evitar_sempre)
}

// A casa é gravada no relógio do dia em que cada item foi confirmado; depois o relógio volta a agora.
async function aplicarCasa(
  stores: Stores,
  clock: ReturnType<typeof createFixedClock>,
  contaId: string,
  c: Cenario,
): Promise<void> {
  for (const item of c.casa) {
    clock.set(isoMenos(c.agora, item.diasDesdeConfirmacao ?? 0))
    await stores.pantry.registrar(contaId, [{ alimento_id: item.alimento_id }], "conversa")
  }
  clock.set(c.agora)
  for (const item of c.casa.filter((i) => i.sempre_tenho)) {
    const linha = (await stores.pantry.listar(contaId)).find(
      (i) => i.alimento_id === item.alimento_id,
    )
    if (linha) await stores.pantry.definirSempreTenho(contaId, linha.id, true)
  }
}

async function aplicarFaltas(
  stores: Stores,
  contaId: string,
  c: Cenario,
  fuso: string | undefined,
): Promise<void> {
  for (const falta of c.faltas ?? []) {
    const dia = diaLocal(new Date(isoMenos(c.agora, falta.diasAtras)), fuso)
    await stores.shortages.registrar(
      contaId,
      [{ alimento_id: falta.alimento_id, origem: "nao_tenho" }],
      dia,
    )
  }
}

type Resultado = "ajudou" | "nao_ajudou"
const ehResultado = (r: string): r is Resultado => r === "ajudou" || r === "nao_ajudou"

// Soma o que falta da contagem; os que já estão em ultimos_resultados entram depois, em ordem.
async function somarResultado(
  stores: Stores,
  contaId: string,
  item: { tipo: "alimento" | "pratica" | "preparo"; id: string },
  resultado: Resultado,
  total: number,
  ultimos: string[],
): Promise<void> {
  const jaContados = ultimos.filter((u) => u === resultado).length
  for (let i = 0; i < total - jaContados; i++) {
    await stores.preferences.contarResultado(contaId, item, resultado)
  }
}

// Os últimos resultados entram do mais antigo para o mais recente, para ficar mais recente primeiro.
async function aplicarPreferencia(
  stores: Stores,
  contaId: string,
  p: NonNullable<Cenario["preferencias"]>[number],
): Promise<void> {
  const item = { tipo: p.tipo, id: p.id }
  if (p.gosto) await stores.preferences.definirGosto(contaId, item, p.gosto)
  const ultimos = p.ultimos_resultados ?? []
  await somarResultado(stores, contaId, item, "ajudou", p.ajudou ?? 0, ultimos)
  await somarResultado(stores, contaId, item, "nao_ajudou", p.nao_ajudou ?? 0, ultimos)
  for (const resultado of [...ultimos].reverse()) {
    if (ehResultado(resultado)) await stores.preferences.contarResultado(contaId, item, resultado)
  }
}

async function aplicarPreferencias(stores: Stores, contaId: string, c: Cenario): Promise<void> {
  for (const p of c.preferencias ?? []) await aplicarPreferencia(stores, contaId, p)
}

function aplicarClima(weather: FakeWeather, clima: Cenario["clima"]): void {
  if (clima === "fora_do_ar") weather.foraDoAr(true)
  else if (clima) weather.set(clima)
}

/**
 * Monta um cenário em memória: stores, ledger e clima em memória, relógio fixo em c.agora,
 * base real de data/ (pelo container), telemetria em memória, roteador real sobre o ledger,
 * serviço de runs e companion.
 */
export async function montarCenario(
  c: Cenario,
  opts: OpcoesDoCenario = {},
): Promise<{ contaId: string; deps: DepsDoCenario }> {
  const clock = createFixedClock(c.agora)
  const telemetry = createMemoryTelemetry()
  const ledger = createMemoryLedger(clock)
  const weather = createFakeWeather()
  const runtime = opts.runtime ?? createScriptedRuntime(c.roteiro, clock)
  const router = createModelRouter({ ledger, clock, telemetry })
  // O container lê a base real de data/ na primeira vez; os stores consultam a mesma base.
  const stores = createMemoryStores(clock, {
    alimentoExiste: (id) => Boolean(container.knowledge.alimento(id)),
  })
  const container = createContainer({
    clock,
    telemetry,
    ledger,
    weather,
    router,
    runtime,
    stores,
    tx: stores,
  })

  const principal = opts.esgotar ? llmCotas.papeis[opts.esgotar][0] : undefined
  if (principal) await esgotarModelos(ledger, [principal])
  // Cenário com o papel esgotado: todos os modelos do papel saem do ar no dia.
  if (c.esgotado) await esgotarModelos(ledger, llmCotas.papeis[c.esgotado])

  const conta = await stores.accounts.criar({ tipo: "demo" })
  await aplicarPerfil(stores, conta.id, c)
  await aplicarCasa(stores, clock, conta.id, c)
  await aplicarFaltas(stores, conta.id, c, c.perfil.cidade?.fuso)
  await aplicarPreferencias(stores, conta.id, c)
  aplicarClima(weather, c.clima)

  return {
    contaId: conta.id,
    deps: {
      clock,
      stores,
      telemetry,
      ledger,
      router,
      weather,
      runtime,
      runs: container.runs,
      companion: container.companion,
    },
  }
}
