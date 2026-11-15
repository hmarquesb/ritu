// Casos do eval com LLM: listar por checkpoint, despachar por tipo, montar os Retornos falsos do Intérprete,
// conferir expectativas e colher o resultado de um run. Quem escolhe o container é o runner (scripts/eval-llm.ts);
// aqui as dependências entram por parâmetro, para que os testes rodem com fakes.
import { z } from "zod"
import {
  type CasoC1,
  casosC1,
  type ResultadoDoRun,
  type Trajetoria,
} from "../../evals/llm/casos/c1"
import {
  type CasoC2,
  type CasoConversa,
  type CasoInterprete,
  casosC2,
} from "../../evals/llm/casos/c2"
import { checkpoints } from "../../evals/llm/checkpoints"
import type { SaidaDoAcompanhante } from "../../src/core/agents/companion/saida"
import { createInterpreter } from "../../src/core/agents/interpreter/interpretar"
import type { Clock } from "../../src/core/clock"
import type { RespostaDaConversa } from "../../src/core/conversation/conversar"
import type { KnowledgeBase } from "../../src/core/knowledge/knowledge-base"
import { SemModeloError } from "../../src/core/llm/chamar"
import type { LlmClient } from "../../src/core/llm/client"
import type { ModelRouter } from "../../src/core/llm/router"
import type { SugestaoRegistrada } from "../../src/core/memory-schemas"
import type { Retorno } from "../../src/core/outcomes/ports"
import type { AgentRuntime } from "../../src/core/runs/agent-runtime"
import { escolherCaminho } from "../../src/core/runs/caminhos"
import type { Run, RunEtapa } from "../../src/core/runs/ports"
import { createMemoryTelemetry } from "../../src/infra/fakes/memory-telemetry"
import { montarCenario } from "../../test/fixtures/cenarios"
import type { ChecagemDeExpectativa, ResultadoDoCaso, TipoDoCaso } from "./eval-llm-report"

export type CasoDoEval = CasoC1 | CasoC2
export type Pasta = (typeof checkpoints)[keyof typeof checkpoints][number]

const PASTAS: Record<Pasta, CasoDoEval[]> = { c1: casosC1, c2: casosC2 }

const CONTA_FALSA = "conta-eval"
const RUN_FALSO = "run-eval"

export type LinhaDeCaso = { pasta: Pasta; id: string; tipo: TipoDoCaso; titulo: string }

export const ehCheckpoint = (nome: string): nome is keyof typeof checkpoints =>
  Object.hasOwn(checkpoints, nome)

export const nomesDeCheckpoint = (): string[] => Object.keys(checkpoints)

export const tipoDoCaso = (caso: { tipo?: TipoDoCaso }): TipoDoCaso => caso.tipo ?? "acompanhante"

export const ehInterprete = (caso: CasoDoEval): caso is CasoInterprete => caso.tipo === "interprete"
export const ehConversa = (caso: CasoDoEval): caso is CasoConversa => caso.tipo === "conversa"

/** Casos do checkpoint, na ordem das pastas. Nome desconhecido dá erro com a lista. */
export function casosDoCheckpoint(nome: string): { pasta: Pasta; caso: CasoDoEval }[] {
  if (!ehCheckpoint(nome)) {
    throw new Error(
      `Checkpoint desconhecido: ${nome}. Use um de: ${nomesDeCheckpoint().join(", ")}`,
    )
  }
  const pastas: readonly Pasta[] = checkpoints[nome]
  return pastas.flatMap((pasta) => PASTAS[pasta].map((caso) => ({ pasta, caso })))
}

export function listarCasos(nome: string): LinhaDeCaso[] {
  return casosDoCheckpoint(nome).map(({ pasta, caso }) => ({
    pasta,
    id: caso.id,
    tipo: tipoDoCaso(caso),
    titulo: caso.titulo,
  }))
}

export const formatarListagem = (linhas: LinhaDeCaso[]): string =>
  linhas.map((l) => `${l.pasta}  ${l.id}  ${l.tipo}  ${l.titulo}`).join("\n")

/** Versão dos prompts do cabeçalho: sempre a do acompanhante; a do Intérprete entra com caso interprete. */
export function versaoDosPrompts(
  casos: CasoDoEval[],
  versoes: { acompanhante: string; interprete: string },
): string {
  const usadas = [versoes.acompanhante]
  if (casos.some(ehInterprete)) usadas.push(versoes.interprete)
  return usadas.join(", ")
}

export type Rodadores<R> = {
  acompanhante: (caso: CasoC1) => R
  interprete: (caso: CasoInterprete) => R
  conversa: (caso: CasoConversa) => R
}

/** Caso sem tipo (ou acompanhante) vai ao rodador do acompanhante. */
export function despachar<R>(caso: CasoDoEval, rodadores: Rodadores<R>): R {
  if (ehInterprete(caso)) return rodadores.interprete(caso)
  if (ehConversa(caso)) return rodadores.conversa(caso)
  return rodadores.acompanhante(caso)
}

export function conferir<T>(
  lista: { descricao: string; confere: (r: T) => boolean }[],
  r: T,
): ChecagemDeExpectativa[] {
  return lista.map((e) => ({ descricao: e.descricao, ok: e.confere(r) }))
}

/** Os pendentes do caso viram Retornos falsos, numerados p1, p2, … como o Intérprete espera. */
export function retornosFalsos(
  pendentes: { tipo: SugestaoRegistrada["tipo"]; titulo: string }[],
  agora: string,
): Retorno[] {
  return pendentes.map((p, i) => ({
    id: `p${i + 1}`,
    conta_id: CONTA_FALSA,
    run_id: RUN_FALSO,
    sugestao: { tipo: p.tipo, titulo: p.titulo, alimentos: [] },
    status: "aguardando",
    resultado: null,
    origem: null,
    criado_em: agora,
    respondido_em: null,
  }))
}

type SpanVisto = { nome: string; atributos: Record<string, unknown> }
type MetricaVista = { nome: string; rotulos: Record<string, unknown> }

/** Violações da primeira entrega: as n primeiras métricas, n = validacao.violacoes do primeiro span validacao. */
export function violacoesDaPrimeiraEntrega(spans: SpanVisto[], metricas: MetricaVista[]): string[] {
  const primeira = spans.find((s) => s.nome === "validacao")
  const n = Number(primeira?.atributos["validacao.violacoes"] ?? 0)
  return metricas
    .filter((m) => m.nome === "ritu_validacao_violacoes_total")
    .slice(0, n)
    .map((m) => String(m.rotulos.violacao))
}

const repetidas = (tools: string[]): number => tools.length - new Set(tools).size

export function colherResultado(
  saida: SaidaDoAcompanhante,
  status: Run["status"],
  etapas: RunEtapa[],
): ResultadoDoRun {
  return {
    saida,
    status,
    tools: etapas.filter((e) => e.tipo === "tool").map((e) => e.nome),
    chamadasDeModelo: etapas.filter((e) => e.tipo === "llm").length,
    validacoes: etapas.filter((e) => e.tipo === "validacao").map((e) => e.status),
  }
}

export function trajetoria(
  t: Trajetoria | undefined,
  r: ResultadoDoRun,
): { ok: boolean; desnecessarias: number } {
  const proibidas = r.tools.filter((n) => t?.proibidas?.includes(n)).length
  const faltou = (t?.chamadas ?? []).some((n) => !r.tools.includes(n))
  const passou = t?.maxChamadasDeModelo !== undefined && r.chamadasDeModelo > t.maxChamadasDeModelo
  return {
    ok: !faltou && proibidas === 0 && !passou,
    desnecessarias: proibidas + repetidas(r.tools),
  }
}

const modelosSchema = z.object({ decisao: z.array(z.string()).optional() })

export function modelosDoRun(modelos: unknown): string[] {
  const lidos = modelosSchema.safeParse(modelos)
  return lidos.success ? (lidos.data.decisao ?? []) : []
}

export type ParamsDaResposta = {
  caso: { id: string; titulo: string; trajetoria?: Trajetoria }
  tipo: "acompanhante" | "conversa"
  r: ResultadoDoRun
  run: Run
  latenciaMs: number
  violacoes: string[]
  deve: ChecagemDeExpectativa[]
  naoPode: ChecagemDeExpectativa[]
}

/** Caso de resposta (acompanhante ou conversa), sem a explicação do juiz, que o runner acrescenta. */
export function resultadoDaResposta(p: ParamsDaResposta): ResultadoDoCaso {
  const { r, run } = p
  const traj = trajetoria(p.caso.trajetoria, r)
  const houveViolacao = r.validacoes.includes("recusado")
  return {
    id: p.caso.id,
    titulo: p.caso.titulo,
    tipo: p.tipo,
    deve: p.deve,
    naoPode: p.naoPode,
    trajetoriaOk: traj.ok,
    chamadasDesnecessarias: traj.desnecessarias,
    validaNa1a: r.validacoes[0] === "ok",
    houveViolacao,
    corrigiuAposViolacao: houveViolacao && r.saida.origem === "agente",
    violacoesDaPrimeira: p.violacoes,
    uso: {
      decisao: {
        chamadas: r.chamadasDeModelo,
        tokens_entrada: run.tokens_entrada,
        tokens_saida: run.tokens_saida,
      },
    },
    trocas: run.trocas_de_modelo,
    latenciaMs: p.latenciaMs,
    modelos: modelosDoRun(run.modelos),
  }
}

export type DepsDoInterprete = {
  router: ModelRouter
  client: LlmClient
  kb: KnowledgeBase
  clock: Clock
}

const falsas = (lista: { descricao: string }[]): ChecagemDeExpectativa[] =>
  lista.map((e) => ({ descricao: e.descricao, ok: false }))

function interpreteComFalha(
  caso: CasoInterprete,
  motivo: "sem_modelo" | "erro",
  latenciaMs: number,
): ResultadoDoCaso {
  return {
    id: caso.id,
    titulo: caso.titulo,
    tipo: "interprete",
    deve: falsas(caso.deve),
    naoPode: falsas(caso.naoPode),
    trajetoriaOk: true,
    chamadasDesnecessarias: 0,
    validaNa1a: false,
    houveViolacao: false,
    corrigiuAposViolacao: false,
    erro: motivo,
    falsoAlerta: caso.falsoAlerta === true,
    alertou: false,
    uso: {},
    trocas: 0,
    latenciaMs,
    modelos: [],
  }
}

/** Uma chamada do Intérprete. Sem trajetória nem validação no caso: esses campos ficam neutros e a seção Intenção não os lê. */
export async function rodarInterprete(
  caso: CasoInterprete,
  deps: DepsDoInterprete,
): Promise<ResultadoDoCaso> {
  const interpreter = createInterpreter({ ...deps, telemetry: createMemoryTelemetry() })
  const r = await interpreter.interpretar({
    texto: caso.mensagem,
    atalhos: caso.atalhos ?? [],
    conversa: caso.conversa ?? [],
    pendentes: retornosFalsos(caso.pendentes ?? [], deps.clock.now().toISOString()),
  })
  if (!r.ok) return interpreteComFalha(caso, r.motivo, r.duracao_ms)
  const entrada = {
    interpretacao: r.interpretacao,
    caminho: escolherCaminho(r.interpretacao).caminho,
  }
  return {
    id: caso.id,
    titulo: caso.titulo,
    tipo: "interprete",
    deve: conferir(caso.deve, entrada),
    naoPode: conferir(caso.naoPode, entrada),
    trajetoriaOk: true,
    chamadasDesnecessarias: 0,
    validaNa1a: true,
    houveViolacao: false,
    corrigiuAposViolacao: false,
    falsoAlerta: caso.falsoAlerta === true,
    alertou: r.interpretacao.alerta !== undefined,
    uso: {
      apoio: { chamadas: 1, tokens_entrada: r.tokens.entrada, tokens_saida: r.tokens.saida },
    },
    trocas: r.trocas,
    latenciaMs: r.duracao_ms,
    modelos: [r.modelo],
  }
}

export type OpcoesDaConversa = { runtime: AgentRuntime; llm: LlmClient }

/** Uma mensagem pela conversa, com o runtime e o cliente dados. Sem juiz: a explicação fica fora desta conta. */
export async function rodarConversa(
  caso: CasoConversa,
  opts: OpcoesDaConversa,
): Promise<ResultadoDoCaso> {
  const { contaId, deps } = await montarCenario({ ...caso.cenario, roteiro: [] }, opts)
  const inicio = performance.now()
  const resposta: RespostaDaConversa = await deps.conversation.conversar(
    contaId,
    caso.cenario.mensagem,
  )
  const latenciaMs = Math.round(performance.now() - inicio)
  const run = await deps.stores.runs.buscar(contaId, resposta.run_id)
  if (!run) throw new Error(`run ${resposta.run_id} não encontrado`)
  if (!resposta.saida) throw new Error(`run ${resposta.run_id} pausou sem saída`)
  if (resposta.saida.origem === "sem_modelo") throw new SemModeloError()
  const etapas = await deps.stores.runs.etapas(contaId, resposta.run_id)
  const r = colherResultado(resposta.saida, resposta.status, etapas)
  return resultadoDaResposta({
    caso,
    tipo: "conversa",
    r,
    run,
    latenciaMs,
    violacoes: violacoesDaPrimeiraEntrega(deps.telemetry.spans, deps.telemetry.metricas),
    deve: conferir(caso.deve, { resposta, resultado: r }),
    naoPode: conferir(caso.naoPode, { resposta, resultado: r }),
  })
}
