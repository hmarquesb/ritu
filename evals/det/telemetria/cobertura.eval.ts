import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { apagarConta } from "@/core/accounts/apagar"
import { criarDemonstracao, entrarComGoogle } from "@/core/accounts/entrar"
import type { Conta } from "@/core/accounts/types"
import { consumirToque } from "@/core/limits/toques"
import type { ModelRouter } from "@/core/llm/router"
import { medirChamadaMcp } from "@/core/mcp/telemetria"
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
    alimento_id: "gengibre",
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

// Os toques de memória (tocarMemoria soma `ritu_memoria_edicoes_total`) e a conta apagada (apagarConta soma
// `ritu_conta_apagada_total`): os dois emissores da 020.
async function tocarMemoriaEApagar(coleta: Coleta): Promise<void> {
  const c = cenarios["frio-agitada"]
  if (!c) throw new Error("cenário frio-agitada ausente")
  const { contaId, deps } = await montarCenario(c)
  await deps.touches.tocarMemoria(contaId, {
    acao: "gosto",
    item_tipo: "alimento",
    item_id: "gengibre",
    gosto: "gosta",
  })
  const conta = await deps.stores.accounts.buscar(contaId)
  if (!conta) throw new Error("conta do cenário ausente")
  await apagarConta({ stores: deps.stores, telemetry: deps.telemetry }, conta)
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
  await entrarComGoogle(
    { stores, telemetry, testers: [] },
    { sub: "sub-cobertura", email: "a@b.c" },
  )
  coleta.metricas.push(...telemetry.metricas)
}

// Toque barrado: com teto 1, o segundo toque no mesmo minuto é barrado e soma ritu_limite_total.
async function barrarToque(coleta: Coleta): Promise<void> {
  const clock = { now: () => new Date("2026-01-15T15:00:00Z") }
  const telemetry = createMemoryTelemetry()
  const conta: Conta = {
    id: "cobertura-toque",
    tipo: "google",
    google_sub: null,
    email: null,
    expira_em: null,
    tester: false,
    aviso_aceito_em: null,
    evitar_passo: null,
    evitar_lembrete_em: null,
    dosha_adiado_em: null,
    criado_em: "2026-01-10T12:00:00Z",
  }
  // O consumo de toque não usa o roteador de modelos.
  const deps = { limiter: createMemoryLimiter(), router: {} as ModelRouter, clock, telemetry }
  const quem = { conta, ipHash: "cobertura", fuso: "America/Sao_Paulo", teto: 1 }
  await consumirToque(deps, quem)
  await consumirToque(deps, quem)
  coleta.metricas.push(...telemetry.metricas)
}

// Chamada de tool pública (MCP): o span `mcp.tool` e `ritu_mcp_chamadas_total`.
async function chamarToolPublica(coleta: Coleta): Promise<void> {
  const telemetry = createMemoryTelemetry()
  await medirChamadaMcp(
    telemetry,
    "ayurveda.buscar",
    async () => ({ ok: true }),
    () => "ok",
  )
  coleta.spans.push(...telemetry.spans)
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
    await tocarMemoriaEApagar(coleta)
    await entrar(coleta)
    await barrarToque(coleta)
    await chamarToolPublica(coleta)
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
    const esperadas = Object.keys(METRICAS) as NomeDeMetrica[]
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
