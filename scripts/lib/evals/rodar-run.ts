// Runners dos casos que rodam um run: acompanhante e conversa. Cada um monta o cenário, roda as pausas e
// devolve o resultado e o colhido. Sem container: as dependências entram por parâmetro.
import type { CasoC1 } from "../../../evals/llm/casos/c1"
import type { CasoConversa } from "../../../evals/llm/casos/c2"
import type { FamiliaMarcada, Marca, TipoDeCaso } from "../../../evals/llm/tipos"
import type { RespostaDoRun } from "../../../src/core/agents/companion/responder"
import type { RespostaDaConversa } from "../../../src/core/conversation/conversar"
import { RituError } from "../../../src/core/errors"
import { SemModeloError } from "../../../src/core/llm/chamar"
import type { LlmClient } from "../../../src/core/llm/client"
import type { AgentRuntime } from "../../../src/core/runs/agent-runtime"
import type { Run, RunEtapa } from "../../../src/core/runs/ports"
import type { Telemetry } from "../../../src/core/telemetry/ports"
import { type DepsDoCenario, montarCenario, rodarCenario } from "../../../test/fixtures/cenarios"
import { MAXIMO_DE_RETOMADAS } from "../../../test/fixtures/cenarios/rodar"
import { motivosDoJuizDasEtapas } from "../demo-report"
import {
  cenarioDoRunner,
  colherResultado,
  colhidoDoRun,
  conferir,
  contarEtapas,
  MOTIVO_PAUSA_ACIMA_DO_TETO,
  modelosDoRun,
  parteDoRun,
  resolverResposta,
  usoDoRun,
  violacoesDaPrimeiraEntrega,
} from "./colher"
import { type Checagem, type Colhido, calcularAcertou, type ResultadoDoCaso } from "./resultado"

export type CasoRodado = { resultado: ResultadoDoCaso; colhido: Colhido }

type Corpo = {
  checagens: Checagem[]
  run?: ResultadoDoCaso["run"]
  uso: ResultadoDoCaso["uso"]
  trocas: number
  modelos: string[]
  latenciaMs: number
  erro?: string
}

/** Monta o resultado com `acertou` calculado; `run` e `erro` só entram quando há.  */
function montar(
  caso: { id: string; titulo: string; familias: FamiliaMarcada[]; marcas?: Marca[] },
  tipo: TipoDeCaso,
  c: Corpo,
): ResultadoDoCaso {
  return {
    id: caso.id,
    titulo: caso.titulo,
    tipo,
    familias: caso.familias,
    marcas: caso.marcas ?? [],
    checagens: c.checagens,
    acertou: calcularAcertou({ checagens: c.checagens, erro: c.erro }),
    ...(c.run === undefined ? {} : { run: c.run }),
    uso: c.uso,
    trocas: c.trocas,
    latenciaMs: c.latenciaMs,
    modelos: c.modelos,
    ...(c.erro === undefined ? {} : { erro: c.erro }),
  }
}

async function lerRun(deps: DepsDoCenario, contaId: string, runId: string): Promise<Run> {
  const run = await deps.stores.runs.buscar(contaId, runId)
  if (!run) throw new Error(`run ${runId} não encontrado`)
  return run
}

/**
 * Títulos dos retornos de `cenario.retornos` que saíram de `outcomes.pendentes` no fim do caso.
 * A posição de cada retorno em `retornos` casa com o id em `retornosSemeados`.
 */
async function retornosFechadosDo(
  deps: DepsDoCenario,
  contaId: string,
  cenario: { retornos?: { sugestao: { titulo: string } }[] },
): Promise<string[]> {
  const pendentes = new Set((await deps.stores.outcomes.pendentes(contaId)).map((r) => r.id))
  return (cenario.retornos ?? []).flatMap((r, i) => {
    const id = deps.retornosSemeados[i]
    return id !== undefined && !pendentes.has(id) ? [r.sugestao.titulo] : []
  })
}

// A conversa devolve resposta de conversa; a de acompanhante não passa por aqui.
function daConversa(final: RespostaDaConversa | RespostaDoRun): RespostaDaConversa {
  if (!("caminho" in final)) throw new Error("a conversa devolveu resposta de acompanhante")
  return final
}

/** Caso falho por pausa acima do teto: as expectativas contam como não cumpridas. */
function falhasDoCaso(caso: CasoConversa): Checagem[] {
  return [
    ...caso.deve.map((e) => ({ lista: "deve" as const, descricao: e.descricao, ok: false })),
    ...caso.naoPode.map((e) => ({ lista: "nao_pode" as const, descricao: e.descricao, ok: false })),
  ]
}

/** Colhido de um caso sem saída (pausa acima do teto): sem texto, com as etapas. */
function colhidoSemSaida(mensagem: string | undefined, etapas: RunEtapa[]): Colhido {
  const colhido: Colhido = {
    texto: "",
    etapas: etapas.map((e) => ({ tipo: e.tipo, nome: e.nome, status: e.status, resumo: e.resumo })),
  }
  return mensagem === undefined ? colhido : { ...colhido, mensagem }
}

/** Um caso de acompanhante. A pessoa do eval pula cada pergunta e o run segue até o fim. Pausa acima do teto falha o caso. */
export async function rodarAcompanhante(
  caso: CasoC1,
  opts: { runtime: AgentRuntime; telemetria?: Telemetry },
): Promise<CasoRodado> {
  const cenario = { ...cenarioDoRunner(caso.cenario), roteiro: [] }
  const { contaId, deps } = await montarCenario(cenario, opts)
  const inicio = performance.now()
  const rodada = await rodarCenario(deps, contaId, cenario, {
    responder: async () => ({ tipo: "pular" }),
  })
  const latenciaMs = Math.round(performance.now() - inicio)
  const resposta = rodada.final
  const run = await lerRun(deps, contaId, resposta.run_id)
  if (!resposta.saida) {
    throw new RituError(
      "pausa_acima_do_teto",
      `run ${resposta.run_id} pausou mais de ${MAXIMO_DE_RETOMADAS} vezes`,
    )
  }
  if (resposta.saida.origem === "sem_modelo") throw new SemModeloError()
  const saida = resposta.saida
  const etapas = await deps.stores.runs.etapas(contaId, resposta.run_id)
  const r = colherResultado(saida, resposta.status, etapas)
  const resultado = montar(caso, "acompanhante", {
    checagens: [...conferir("deve", caso.deve, r), ...conferir("nao_pode", caso.naoPode, r)],
    run: parteDoRun({
      r,
      run,
      caminho: run.caminho,
      trajetoria: caso.trajetoria,
      violacoes: violacoesDaPrimeiraEntrega(deps.telemetry.spans, deps.telemetry.metricas),
      perguntasFeitas: rodada.perguntas.length,
      contagem: contarEtapas(etapas),
    }),
    uso: usoDoRun(run, r),
    trocas: run.trocas_de_modelo,
    modelos: modelosDoRun(run.modelos),
    latenciaMs,
  })
  const mensagem = cenario.mensagem?.texto ?? cenario.entrada?.texto
  return { resultado, colhido: colhidoDoRun(mensagem, saida, etapas) }
}

/** Uma mensagem pela conversa, respondendo às pausas com as respostas do caso. Sem juiz: a explicação fica fora desta conta. */
export async function rodarConversa(
  caso: CasoConversa,
  opts: { runtime: AgentRuntime; llm: LlmClient; telemetria?: Telemetry },
): Promise<CasoRodado> {
  const cenario = { ...cenarioDoRunner(caso.cenario), roteiro: [] }
  const { contaId, deps } = await montarCenario(cenario, opts)
  const inicio = performance.now()
  const rodada = await rodarCenario(deps, contaId, cenario, {
    responder: async (pergunta, i) => resolverResposta(caso.respostas?.[i], pergunta),
  })
  const latenciaMs = Math.round(performance.now() - inicio)
  const resposta = daConversa(rodada.final)
  const run = await lerRun(deps, contaId, resposta.run_id)
  const etapas = await deps.stores.runs.etapas(contaId, resposta.run_id)
  const mensagem = cenario.mensagem?.texto
  // Ainda pausado depois do teto de retomadas: o caso falha com o motivo, sem run, e a rodada segue.
  if (resposta.status === "waiting_for_input") {
    return {
      resultado: montar(caso, "conversa", {
        checagens: falhasDoCaso(caso),
        uso: {},
        trocas: 0,
        modelos: [],
        latenciaMs,
        erro: MOTIVO_PAUSA_ACIMA_DO_TETO,
      }),
      colhido: colhidoSemSaida(mensagem, etapas),
    }
  }
  if (!resposta.saida) throw new Error(`run ${resposta.run_id} pausou sem saída`)
  if (resposta.saida.origem === "sem_modelo") throw new SemModeloError()
  const saida = resposta.saida
  const contagem = contarEtapas(etapas)
  const r = colherResultado(saida, resposta.status, etapas)
  const perguntas = rodada.perguntas
  const alvo = {
    resposta,
    resultado: r,
    perguntas,
    propostas: saida.propostas,
    retornosFechados: await retornosFechadosDo(deps, contaId, cenario),
    ...contagem,
    juiz: {
      tentativas: run.juiz_tentativas,
      aprovado: run.juiz_aprovado,
      motivos: motivosDoJuizDasEtapas(etapas),
    },
  }
  const resultado = montar(caso, "conversa", {
    checagens: [...conferir("deve", caso.deve, alvo), ...conferir("nao_pode", caso.naoPode, alvo)],
    run: parteDoRun({
      r,
      run,
      caminho: resposta.caminho,
      violacoes: violacoesDaPrimeiraEntrega(deps.telemetry.spans, deps.telemetry.metricas),
      perguntasFeitas: perguntas.length,
      contagem,
    }),
    uso: usoDoRun(run, r),
    trocas: run.trocas_de_modelo,
    modelos: modelosDoRun(run.modelos),
    latenciaMs,
  })
  return { resultado, colhido: colhidoDoRun(mensagem, saida, etapas) }
}
