// Runners dos casos de run pelas rotas: a mesma rodada de `rodar-run`, com cada passo entregue ao handler da rota.
// Só compõe: a rodada, as falhas e o colhido vêm de `rodar-run`.
import type { CasoC1 } from "../../../evals/llm/casos/c1"
import type { CasoConversa } from "../../../evals/llm/casos/c2"
import type { EventoDaTela } from "../../../src/core/conversation/eventos"
import type { LlmClient } from "../../../src/core/llm/client"
import type { AgentRuntime } from "../../../src/core/runs/agent-runtime"
import type { Run } from "../../../src/core/runs/ports"
import type { Telemetry } from "../../../src/core/telemetry/ports"
import {
  type DepsDoCenario,
  type PassoDeRota,
  type RodadaPelasRotas,
  RotaFalhouError,
  rodarCenarioPelasRotas,
} from "../../../test/fixtures/cenarios"
import type { Checagem } from "./resultado"
import {
  type CasoRodado,
  type Composicao,
  type FalhaDaRodada,
  rodarAcompanhante,
  rodarConversa,
} from "./rodar-run"

const ROTA_INICIAR = "POST /api/runs"

/** Índices dos passos que iniciam um run: o segundo marca o começo de outra mensagem. */
function indicesDeIniciar(passos: PassoDeRota[]): number[] {
  return passos.flatMap((p, i) => (p.rota === ROTA_INICIAR ? [i] : []))
}

/** A primeira parte da rodada: da primeira mensagem até antes da segunda (A3). */
function primeiraParte(passos: PassoDeRota[]): PassoDeRota[] {
  return passos.slice(0, indicesDeIniciar(passos)[1] ?? passos.length)
}

/** Descrição do passo que não respondeu 200; `undefined` quando todos responderam 200. */
function descricaoDaFalha(passos: PassoDeRota[]): string | undefined {
  const i = passos.findIndex((p) => p.status !== 200)
  const passo = passos[i]
  if (passo === undefined) return undefined
  if (passo.status === 429) return "a rota barrou a conversa (429)"
  if (passo.status === 409 && i === indicesDeIniciar(passos)[1]) return "havia um run aberto (409)"
  return `${passo.rota} respondeu ${passo.status}`
}

/** O último `fim` de uma lista de eventos, já estreitado. */
function ultimoFim(eventos: EventoDaTela[]) {
  for (let i = eventos.length - 1; i >= 0; i--) {
    const e = eventos[i]
    if (e?.tipo === "fim") return e
  }
  return undefined
}

/** O texto que o run gravou para a pessoa (o `resposta` do saída), ou `undefined` quando não há. */
function respostaGravada(run: Run): string | undefined {
  const saida = run.saida
  if (typeof saida !== "object" || saida === null) return undefined
  const resposta = (saida as Record<string, unknown>).resposta
  return typeof resposta === "string" && resposta.trim() !== "" ? resposta : undefined
}

/** As cinco checagens da lista `rota`. Sem passos (acompanhante cuja rodada não passou por rota), nenhuma. */
export function checagensDeRota(passos: PassoDeRota[], run?: Run): Checagem[] {
  if (passos.length === 0) return []
  const eventos = primeiraParte(passos).flatMap((p) => p.eventos ?? [])
  const idsDoInicio = eventos.flatMap((e) => (e.tipo === "inicio" ? [e.run_id] : []))
  const fim = ultimoFim(eventos)
  const falha = descricaoDaFalha(passos)
  return [
    {
      lista: "rota",
      descricao: falha ?? "toda rota respondeu 200",
      ok: falha === undefined,
    },
    {
      lista: "rota",
      descricao: "cada linha do NDJSON valida no schema do evento",
      ok: !passos.some((p) => p.erroDeSchema !== undefined),
    },
    {
      lista: "rota",
      descricao: "cada fluxo começa com inicio e termina com fim",
      ok: passos.every(
        (p) =>
          p.eventos === undefined ||
          (p.eventos[0]?.tipo === "inicio" && p.eventos.at(-1)?.tipo === "fim"),
      ),
    },
    {
      lista: "rota",
      descricao: "o run_id do inicio é o do run gravado",
      ok: run !== undefined && idsDoInicio.length > 0 && idsDoInicio.every((id) => id === run.id),
    },
    {
      lista: "rota",
      descricao: "o texto da visão do fim é o da resposta do run",
      ok: run !== undefined && fim !== undefined && fim.visao.resposta === respostaGravada(run),
    },
  ]
}

function runIdDosPassos(passos: PassoDeRota[]): string | undefined {
  for (const p of passos) {
    for (const e of p.eventos ?? []) if (e.tipo === "inicio") return e.run_id
  }
  return undefined
}

/** Falha de rota da rodada: lê o run pelo `inicio` da falha e devolve o erro e as checagens de rota. */
export async function falhaDaRota(
  erro: unknown,
  deps: DepsDoCenario,
  contaId: string,
): Promise<FalhaDaRodada | undefined> {
  if (!(erro instanceof RotaFalhouError)) return undefined
  const runId = runIdDosPassos(erro.passos)
  const run = runId === undefined ? undefined : await deps.stores.runs.buscar(contaId, runId)
  return {
    erro: descricaoDaFalha(erro.passos) ?? "rota falhou",
    checagens: checagensDeRota(erro.passos, run),
    ...(runId === undefined ? {} : { runId }),
  }
}

/** A composição de rota de um caso: a rodada pelas rotas, as checagens de rota e a falha de rota. */
function composicaoDeRota(escopo: string): Composicao<RodadaPelasRotas> {
  return {
    rodar: (deps, contaId, cenario, opcoes) =>
      rodarCenarioPelasRotas(deps, contaId, cenario, { ...opcoes, escopo }),
    extras: (rodada, run) => checagensDeRota(rodada.passos, run),
    falha: falhaDaRota,
  }
}

/** Um caso de acompanhante pelas rotas. A primeira chamada segue em `companion.responder`, sem passo de rota. */
export function rodarAcompanhantePelasRotas(
  caso: CasoC1,
  opts: { runtime: AgentRuntime; telemetria?: Telemetry },
): Promise<CasoRodado> {
  return rodarAcompanhante(caso, { ...opts, ...composicaoDeRota(caso.id) })
}

/** Uma mensagem de conversa pelas rotas, com as checagens de rota da primeira parte da rodada. */
export function rodarConversaPelasRotas(
  caso: CasoConversa,
  opts: { runtime: AgentRuntime; llm: LlmClient; telemetria?: Telemetry },
): Promise<CasoRodado> {
  return rodarConversa(caso, { ...opts, ...composicaoDeRota(caso.id) })
}
