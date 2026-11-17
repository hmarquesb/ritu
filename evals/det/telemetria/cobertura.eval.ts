import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { criarDemonstracao, entrarComGoogle } from "@/core/accounts/entrar"
import {
  type AtributoPermitido,
  type CodigoDeLog,
  METRICAS,
  type NomeDeMetrica,
  type NomeDeSpan,
  SPANS,
} from "@/core/telemetry/nomes"
import { createContainer } from "@/infra/container"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import type {
  LogRegistrado,
  MetricaRegistrada,
  SpanRegistrado,
} from "@/infra/fakes/memory-telemetry"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import {
  cenarios,
  cenariosComAprovacao,
  cenariosComPausa,
  cenariosDeAprendizado,
  cenariosDeConversa,
  cenariosDeGuardrails,
  cenariosDeMemoria,
  cenariosDeTelemetria,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { Cenario } from "../../../test/fixtures/cenarios/tipos"

// Cobertura: a suíte de cenários (mais os toques e a detecção diária) emite todo span, toda métrica e os logs da lista,
// com os atributos e rótulos declarados. Roda uma vez; cada `it` confere uma parte.

const CLIMA = ["clima.agora", "clima.proximas_horas"]

// Métricas da 020 ainda sem quem as emita (tocarMemoria e apagarConta). A 020 T15 tira esta lista e as emite aqui.
const SEM_EMISSOR_AINDA: NomeDeMetrica[] = [
  "ritu_memoria_edicoes_total",
  "ritu_conta_apagada_total",
]

const LOGS_DA_LISTA: CodigoDeLog[] = [
  "run_inicio",
  "run_fim",
  "clima_indisponivel",
  "troca_de_modelo",
  "sem_modelo",
  "llm_erro",
  "resposta_segura",
]

type Coleta = { spans: SpanRegistrado[]; metricas: MetricaRegistrada[]; logs: LogRegistrado[] }

function juntar(coleta: Coleta, deps: DepsDoCenario): void {
  coleta.spans.push(...deps.telemetry.spans)
  coleta.metricas.push(...deps.telemetry.metricas)
  coleta.logs.push(...deps.telemetry.logs)
}

function todosOsCenarios(): Cenario[] {
  return [
    ...Object.values(cenarios),
    ...Object.values(cenariosDeConversa),
    ...Object.values(cenariosComPausa),
    ...Object.values(cenariosComAprovacao),
    ...Object.values(cenariosDeAprendizado),
    ...Object.values(cenariosDeMemoria),
    ...Object.values(cenariosDeGuardrails),
    ...Object.values(cenariosDeTelemetria),
  ]
}

async function rodarOsCenarios(coleta: Coleta): Promise<void> {
  for (const c of todosOsCenarios()) {
    const { contaId, deps } = await montarCenario(c)
    await rodarCenario(deps, contaId, c)
    juntar(coleta, deps)
  }
}

// Troca de modelo: o papel de decisão com o principal esgotado.
async function rodarComTroca(coleta: Coleta): Promise<void> {
  const c = cenarios["frio-agitada"]
  if (!c) throw new Error("cenário frio-agitada ausente")
  const { contaId, deps } = await montarCenario(c, { esgotar: "decisao" })
  await rodarCenario(deps, contaId, c)
  juntar(coleta, deps)
}

// Os quatro toques sobre um run entregue (chá do frio-agitada).
async function tocarRunEntregue(coleta: Coleta): Promise<void> {
  const c = cenarios["frio-agitada"]
  if (!c) throw new Error("cenário frio-agitada ausente")
  const { contaId, deps } = await montarCenario(c)
  const r = await deps.companion.responder(contaId, c.entrada)
  if (r.status !== "done" || !r.saida) throw new Error("run sem saída")
  const retornoId = r.saida.sugestoes[0]?.retorno_id
  if (!retornoId) throw new Error("sugestão sem retorno_id")
  await deps.touches.tocarVoto(contaId, r.run_id, "up")
  await deps.touches.tocarGosto(contaId, { tipo: "alimento", id: "gengibre" }, "gosta")
  // A troca acha o alvo só enquanto o retorno da sugestão está pendente: troca antes de responder o retorno.
  await deps.touches.trocarIngrediente(contaId, {
    runId: r.run_id,
    sugestao: 0,
    alimento_id: "canela",
    motivo: "trocar",
  })
  await deps.touches.tocarRetorno(contaId, retornoId, "ajudou")
  juntar(coleta, deps)
}

// Erro do modelo: o Intérprete recebe rate_limit antes da resposta; o Juiz depois, com a aprovação.
async function rodarComErroDoModelo(coleta: Coleta): Promise<void> {
  const c = cenariosDeTelemetria["llm-erro"]
  if (!c?.interpretacao) throw new Error("cenário llm-erro sem interpretação")
  const llm = createFakeLlm([{ erro: "rate_limit" }, c.interpretacao, { apontamentos: [] }])
  const { contaId, deps } = await montarCenario(c, { llm })
  await rodarCenario(deps, contaId, c)
  juntar(coleta, deps)
}

// Detecção diária (o job de padrões) num cenário com histórico.
async function detectarComHistorico(coleta: Coleta): Promise<void> {
  const c = cenariosDeMemoria["padrao-confirmado"]
  if (!c) throw new Error("cenário padrao-confirmado ausente")
  const { deps } = await montarCenario(c)
  await deps.patterns.detectarPadroes()
  juntar(coleta, deps)
}

// Entrada: a demonstração e a conta Google, pelo caminho real, com stores e limitador em memória.
async function entrar(coleta: Coleta): Promise<void> {
  vi.stubEnv("RITU_MODO", "e2e")
  const clock = { now: () => new Date("2026-01-15T12:00:00Z") }
  const stores = createMemoryStores(clock)
  const container = createContainer({ clock, stores, tx: stores, limiter: createMemoryLimiter() })
  const telemetry = createMemoryTelemetry()
  await criarDemonstracao(
    {
      tx: stores,
      limiter: createMemoryLimiter(),
      clock,
      kb: container.knowledge,
      seed: container.demoSeed,
      telemetry,
    },
    { ipHash: "cobertura", semSeed: true },
  )
  await entrarComGoogle({ stores, telemetry }, { sub: "sub-cobertura", email: "a@b.c" })
  coleta.metricas.push(...telemetry.metricas)
}

// Atributos que só são obrigatórios em certos casos (OBSERVABILITY.md §3 e nomes.ts).
type Condicional = {
  aplica: (s: SpanRegistrado) => boolean
  exige: AtributoPermitido[]
}

const CONDICIONAIS: Condicional[] = [
  {
    aplica: (s) => s.nome === "run" && s.atributos["run.caminho"] === "acompanhante",
    exige: ["prompt.versao"],
  },
  {
    aplica: (s) => s.nome === "tool.chamada" && CLIMA.includes(String(s.atributos["tool.nome"])),
    exige: ["cache.hit"],
  },
  {
    aplica: (s) => s.nome === "toque" && s.atributos.tipo === "troca",
    exige: ["motivo", "resultado"],
  },
]

function ausentes(s: SpanRegistrado, exige: readonly AtributoPermitido[]): string[] {
  return exige.filter((a) => s.atributos[a] === undefined).map((a) => `${s.nome}.${a}`)
}

// Span sem falha tem os atributos de SPANS; os condicionais valem quando o caso aparece.
function faltasDeAtributos(spans: SpanRegistrado[]): string[] {
  const faltas: string[] = []
  for (const s of spans) {
    if (!s.falha) faltas.push(...ausentes(s, SPANS[s.nome]))
    for (const c of CONDICIONAIS) {
      if (c.aplica(s)) faltas.push(...ausentes(s, c.exige))
    }
  }
  return faltas
}

describe("cobertura da telemetria pelos cenários", () => {
  const coleta: Coleta = { spans: [], metricas: [], logs: [] }

  beforeAll(async () => {
    await rodarOsCenarios(coleta)
    await rodarComTroca(coleta)
    await rodarComErroDoModelo(coleta)
    await tocarRunEntregue(coleta)
    await detectarComHistorico(coleta)
    await entrar(coleta)
  }, 180_000)

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it("todo span de SPANS é emitido pelo menos uma vez", () => {
    const emitidos = new Set(coleta.spans.map((s) => s.nome))
    const esperados = Object.keys(SPANS) as NomeDeSpan[]
    expect(esperados.filter((n) => !emitidos.has(n))).toEqual([])
  })

  it("toda métrica de METRICAS é emitida pelo menos uma vez", () => {
    const emitidas = new Set(coleta.metricas.map((m) => m.nome))
    const esperadas = (Object.keys(METRICAS) as NomeDeMetrica[]).filter(
      (n) => !SEM_EMISSOR_AINDA.includes(n),
    )
    expect(esperadas.filter((n) => !emitidas.has(n))).toEqual([])
  })

  it("os sete logs da lista são emitidos", () => {
    const emitidos = new Set(coleta.logs.map((l) => l.codigo))
    expect(LOGS_DA_LISTA.filter((c) => !emitidos.has(c))).toEqual([])
  })

  it("todo span sem falha tem os atributos obrigatórios de SPANS", () => {
    expect([...new Set(faltasDeAtributos(coleta.spans))].sort()).toEqual([])
  })

  it("todo run com agente leva prompt.versao e toda tool de clima leva cache.hit", () => {
    const comAgente = coleta.spans.filter(
      (s) => s.nome === "run" && s.atributos["run.caminho"] === "acompanhante",
    )
    expect(comAgente.length).toBeGreaterThan(0)
    expect(comAgente.filter((s) => s.atributos["prompt.versao"] === undefined)).toEqual([])
    const clima = coleta.spans.filter(
      (s) => s.nome === "tool.chamada" && CLIMA.includes(String(s.atributos["tool.nome"])),
    )
    expect(clima.length).toBeGreaterThan(0)
    expect(clima.filter((s) => s.atributos["cache.hit"] === undefined)).toEqual([])
  })
})
