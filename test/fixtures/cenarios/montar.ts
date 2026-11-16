import { llmCotas, type Papel } from "@config/llm-cotas"
import type { createCompanion } from "@/core/agents/companion/responder"
import type { createInterpreter } from "@/core/agents/interpreter/interpretar"
import type { SaidaDoInterprete } from "@/core/agents/interpreter/saida"
import { createJudge, type Judge } from "@/core/agents/judge/julgar"
import { createMemoryAgent, type MemoryAgent } from "@/core/agents/memory/memoria"
import { resumoPorCodigo } from "@/core/agents/memory/resumo"
import type { createConversation } from "@/core/conversation/conversar"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { LlmClient } from "@/core/llm/client"
import type { UsageLedger } from "@/core/llm/ledger"
import { createModelRouter, type ModelRouter } from "@/core/llm/router"
import type { createPatterns } from "@/core/patterns"
import type { createRoutine } from "@/core/routine"
import type { AgentRuntime } from "@/core/runs/agent-runtime"
import type { Caminho } from "@/core/runs/ports"
import type { createRunService } from "@/core/runs/run-service"
import type { Stores } from "@/core/stores"
import { diaLocal } from "@/core/time/dia-local"
import type { createTouches } from "@/core/touches"
import { createCachedWeatherSource } from "@/core/weather/cache"
import { createContainer } from "@/infra/container"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
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
  llm: LlmClient
  runs: ReturnType<typeof createRunService>
  companion: ReturnType<typeof createCompanion>
  interpreter: ReturnType<typeof createInterpreter>
  judge: Judge
  conversation: ReturnType<typeof createConversation>
  touches: ReturnType<typeof createTouches>
  memory: MemoryAgent
  routine: ReturnType<typeof createRoutine>
  patterns: ReturnType<typeof createPatterns>
  // Ids dos retornos de `Cenario.retornos`, na mesma ordem (D12: toque `semeado`).
  retornosSemeados: string[]
}

export type OpcoesDoCenario = {
  runtime?: AgentRuntime
  // Cliente do Intérprete; padrão: createFakeLlm com `interpretacao` do cenário.
  llm?: LlmClient
  // Esgota, no dia, só o modelo principal do papel (registrarRateLimit × rateLimitsParaEsgotarODia).
  esgotar?: Papel
}

// Fila do Intérprete: a da mensagem e, com `depois`, a da segunda mensagem (D16).
function interpretacoesDo(c: Cenario): SaidaDoInterprete[] {
  const filas = [c.interpretacao, c.depois?.interpretacao]
  return filas.filter((i): i is SaidaDoInterprete => i !== undefined)
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

// Run já encerrado, como os de conversas anteriores; o relógio precisa estar no momento do run.
async function criarRunEncerrado(
  stores: Stores,
  contaId: string,
  dia: string,
  caminho: Caminho,
): Promise<string> {
  const run = await stores.runs.criar(contaId, { caminho: "acompanhante", intencoes: [], dia })
  await stores.runs.atualizar(contaId, run.id, { status: "done", caminho })
  return run.id
}

// Os retornos entram com o relógio em agora − diasAtras; depois o relógio volta a agora. Devolve os ids, na ordem.
async function aplicarRetornos(
  stores: Stores,
  clock: ReturnType<typeof createFixedClock>,
  contaId: string,
  c: Cenario,
): Promise<string[]> {
  const ids: string[] = []
  for (const r of c.retornos ?? []) {
    clock.set(isoMenos(c.agora, r.diasAtras))
    const dia = diaLocal(clock.now(), c.perfil.cidade?.fuso)
    const runId = await criarRunEncerrado(stores, contaId, dia, "acompanhante")
    const [criado] = await stores.outcomes.criar(contaId, runId, [r.sugestao])
    if (criado) ids.push(criado.id)
  }
  clock.set(c.agora)
  return ids
}

// As mensagens anteriores entram com o relógio em agora; cada uma tem o seu run encerrado.
async function aplicarMensagens(
  stores: Stores,
  clock: ReturnType<typeof createFixedClock>,
  contaId: string,
  c: Cenario,
): Promise<void> {
  clock.set(c.agora)
  const dia = diaLocal(clock.now(), c.perfil.cidade?.fuso)
  for (const m of c.mensagens ?? []) {
    const runId = await criarRunEncerrado(stores, contaId, dia, m.caminho ?? "acompanhante")
    await stores.messages.gravar(contaId, {
      run_id: runId,
      autor: m.autor,
      texto: m.texto,
      com_incomodo: false,
      dia,
    })
  }
}

// Notas de rotina, da mais antiga para a mais recente; com alguma, o resumo inicial é o de resumoPorCodigo.
async function aplicarRotina(
  stores: Stores,
  clock: ReturnType<typeof createFixedClock>,
  contaId: string,
  c: Cenario,
): Promise<void> {
  const notas = [...(c.rotina ?? [])].sort((a, b) => b.diasAtras - a.diasAtras)
  for (const nota of notas) {
    clock.set(isoMenos(c.agora, nota.diasAtras))
    await stores.routine.anotar(contaId, nota.texto)
  }
  clock.set(c.agora)
  if (notas.length > 0) {
    const ativas = await stores.routine.notasAtivas(contaId)
    await stores.routine.gravarResumo(contaId, resumoPorCodigo(ativas))
  }
}

// Histórico com o relógio em agora − diasAtras: cada item é um run done com momento; com sugestão, o retorno e, com resultado, a resposta.
async function aplicarHistorico(
  stores: Stores,
  clock: ReturnType<typeof createFixedClock>,
  contaId: string,
  c: Cenario,
): Promise<void> {
  for (const h of c.historico ?? []) {
    clock.set(isoMenos(c.agora, h.diasAtras))
    const dia = diaLocal(clock.now(), c.perfil.cidade?.fuso)
    const run = await stores.runs.criar(contaId, { caminho: "acompanhante", intencoes: [], dia })
    await stores.runs.atualizar(contaId, run.id, {
      status: "done",
      com_incomodo: false,
      momento: { estados: h.estados, momento_do_dia: "noite", gunas_buscadas: [] },
    })
    if (h.sugestao) {
      const [retorno] = await stores.outcomes.criar(contaId, run.id, [h.sugestao])
      if (retorno && h.resultado) {
        await stores.outcomes.responder(contaId, retorno.id, h.resultado, "toque")
      }
    }
  }
  clock.set(c.agora)
}

// Padrões semeados (D12): propostos, e decididos quando o status não é candidato.
async function aplicarPadroes(stores: Stores, contaId: string, c: Cenario): Promise<void> {
  for (const p of c.padroes ?? []) {
    const criado = await stores.patterns.propor(contaId, {
      tipo: p.tipo,
      chave: p.chave,
      frase: p.frase,
      ocorrencias: p.ocorrencias,
    })
    if (criado && p.status !== "candidato") {
      await stores.patterns.decidir(contaId, criado.id, p.status)
    }
  }
}

// Memória do cenário (D7): com opts.llm, o mesmo cliente; sem ele, uma resposta roteirizada; com "sem_modelo", o apoio esgotado.
async function criarMemoria(
  c: Cenario,
  opts: OpcoesDoCenario,
  base: {
    clock: ReturnType<typeof createFixedClock>
    telemetry: MemoryTelemetry
    router: ModelRouter
    kb: KnowledgeBase
  },
): Promise<MemoryAgent> {
  const { clock, telemetry, kb } = base
  if (opts.llm) {
    return createMemoryAgent({ router: base.router, client: opts.llm, kb, telemetry, clock })
  }
  if (c.memoria === "sem_modelo") {
    const ledger = createMemoryLedger(clock)
    await esgotarModelos(ledger, llmCotas.papeis.apoio)
    const router = createModelRouter({ ledger, clock, telemetry })
    return createMemoryAgent({ router, client: createFakeLlm([]), kb, telemetry, clock })
  }
  const respostas = c.memoria ? [c.memoria] : []
  const client = createFakeLlm(respostas)
  return createMemoryAgent({ router: base.router, client, kb, telemetry, clock })
}

// Roteador sem nenhum modelo do papel apoio no dia.
async function roteadorSemApoio(
  clock: ReturnType<typeof createFixedClock>,
  telemetry: MemoryTelemetry,
): Promise<ModelRouter> {
  const ledger = createMemoryLedger(clock)
  await esgotarModelos(ledger, llmCotas.papeis.apoio)
  return createModelRouter({ ledger, clock, telemetry })
}

// Juiz do cenário (D15): com opts.llm, o mesmo cliente; sem ele, cada julgamento tira a próxima resposta de c.juiz
// e roda num cliente só dele; "sem_modelo" roda com o apoio esgotado. Fila vazia aprova. A base é lida na chamada.
function criarJuiz(
  c: Cenario,
  opts: OpcoesDoCenario,
  base: {
    clock: ReturnType<typeof createFixedClock>
    telemetry: MemoryTelemetry
    router: ModelRouter
    kb: () => KnowledgeBase
  },
): Judge {
  const { clock, telemetry, router } = base
  const respostas = [...(c.juiz ?? [])]
  return {
    async julgar(p) {
      const kb = base.kb()
      if (opts.llm) return createJudge({ router, client: opts.llm, kb, telemetry, clock }).julgar(p)
      const resposta = respostas.shift() ?? { apontamentos: [] }
      const semModelo = resposta === "sem_modelo"
      const roteador = semModelo ? await roteadorSemApoio(clock, telemetry) : router
      const client = createFakeLlm(semModelo ? [] : [resposta])
      return createJudge({ router: roteador, client, kb, telemetry, clock }).julgar(p)
    },
  }
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
  if (!c.entrada && !c.mensagem) {
    throw new Error(`cenário ${c.nome} sem entrada nem mensagem`)
  }
  const clock = createFixedClock(c.agora)
  const telemetry = createMemoryTelemetry()
  const ledger = createMemoryLedger(clock)
  const weather = createFakeWeather()
  const runtime =
    opts.runtime ?? createScriptedRuntime([...c.roteiro, ...(c.depois?.roteiro ?? [])], clock)
  const router = createModelRouter({ ledger, clock, telemetry })
  const llm = opts.llm ?? createFakeLlm(interpretacoesDo(c))
  // A Memória é criada na primeira chamada: o container ainda não existe quando os overrides são montados (D7).
  let memoria: Promise<MemoryAgent> | undefined
  const memory: MemoryAgent = {
    resumir(notas) {
      memoria ??= criarMemoria(c, opts, { clock, telemetry, router, kb: container.knowledge })
      return memoria.then((m) => m.resumir(notas))
    },
  }
  // O container lê a base real de data/ na primeira vez; os stores consultam a mesma base.
  const stores = createMemoryStores(clock, {
    alimentoExiste: (id) => Boolean(container.knowledge.alimento(id)),
  })
  const judge = criarJuiz(c, opts, { clock, telemetry, router, kb: () => container.knowledge })
  const container = createContainer({
    clock,
    telemetry,
    ledger,
    weather: createCachedWeatherSource(weather, clock, telemetry),
    router,
    runtime,
    llm,
    stores,
    tx: stores,
    memory,
    judge,
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
  const retornosSemeados = await aplicarRetornos(stores, clock, conta.id, c)
  await aplicarMensagens(stores, clock, conta.id, c)
  await aplicarRotina(stores, clock, conta.id, c)
  await aplicarHistorico(stores, clock, conta.id, c)
  await aplicarPadroes(stores, conta.id, c)
  if (c.detectar) await container.patterns.detectarPadroesDaConta(conta.id)
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
      llm,
      runs: container.runs,
      companion: container.companion,
      interpreter: container.interpreter,
      judge: container.judge,
      conversation: container.conversation,
      touches: container.touches,
      memory: container.memory,
      routine: container.routine,
      patterns: container.patterns,
      retornosSemeados,
    },
  }
}
