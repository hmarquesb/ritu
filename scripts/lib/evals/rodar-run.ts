// Runners dos casos que rodam um run: acompanhante e conversa. Cada um monta o cenário, roda as pausas e
// devolve o resultado e o colhido. Sem container: as dependências entram por parâmetro.
import type { CasoC1, ResultadoDoRun } from "../../../evals/llm/casos/c1"
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
import {
  type DepsDoCenario,
  montarCenario,
  type OpcoesDaRodada,
  type RodadaDoCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
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
import {
  type Classificacao,
  classificarCaso,
  type EntradaDaClassificacao,
  fecharEstado,
  type MetricaVista,
  sinaisDeErroDoLlm,
} from "./inconclusivo"
import { type Checagem, type Colhido, calcularAcertou, type ResultadoDoCaso } from "./resultado"

export type CasoRodado = { resultado: ResultadoDoCaso; colhido: Colhido }

type CenarioDaRodada = Parameters<typeof rodarCenario>[2]

/** Roda a sequência de um caso: o padrão é `rodarCenario`; cada runner de rota passa a sua. */
export type Rodador<R extends RodadaDoCenario> = (
  deps: DepsDoCenario,
  contaId: string,
  cenario: CenarioDaRodada,
  opcoes: OpcoesDaRodada,
) => Promise<R>

/** Falha de uma rota no meio da rodada: o erro do caso, as checagens de rota e o run, se ele existe. */
export type FalhaDaRodada = { erro: string; checagens: Checagem[]; runId?: string }

/** O que cada runner aceita para compor a rodada: a função, as checagens extras e o tratamento de falha. */
export type Composicao<R extends RodadaDoCenario> = {
  rodar?: Rodador<R>
  extras?: (rodada: R, run: Run) => Checagem[]
  falha?: (
    erro: unknown,
    deps: DepsDoCenario,
    contaId: string,
  ) => Promise<FalhaDaRodada | undefined>
}

type Corpo = {
  checagens: Checagem[]
  run?: ResultadoDoCaso["run"]
  uso: ResultadoDoCaso["uso"]
  trocas: number
  modelos: string[]
  latenciaMs: number
  erro?: string
  /** O que o run colheu para classificar o caso quando ele não é conclusivo. */
  entrada: Omit<EntradaDaClassificacao, "erro">
  /** Falha de rota: o caso fica `falhou`, sem passar pela classificação de inconclusivo. */
  falhou?: boolean
}

/** Monta o resultado com `estado` e `acertou` fechados; `run` e `erro` só entram quando há.  */
function montar(
  caso: { id: string; titulo: string; familias: FamiliaMarcada[]; marcas?: Marca[] },
  tipo: TipoDeCaso,
  c: Corpo,
): ResultadoDoCaso {
  const classe: Classificacao = c.falhou
    ? { estado: "falhou" }
    : fecharEstado(
        calcularAcertou({ checagens: c.checagens, erro: c.erro }),
        classificarCaso({ ...c.entrada, erro: c.erro }),
      )
  const inconclusivo =
    classe.inconclusivo === undefined ? {} : { inconclusivo: classe.inconclusivo }
  return {
    id: caso.id,
    titulo: caso.titulo,
    tipo,
    familias: caso.familias,
    marcas: caso.marcas ?? [],
    checagens: c.checagens,
    acertou: classe.estado === "acertou",
    estado: classe.estado,
    ...inconclusivo,
    ...(c.run === undefined ? {} : { run: c.run }),
    uso: c.uso,
    trocas: c.trocas,
    latenciaMs: c.latenciaMs,
    modelos: c.modelos,
    ...(c.erro === undefined ? {} : { erro: c.erro }),
  }
}

/** Estado do Juiz no run: `indisponivel` quando a etapa falhou; senão, o veredito gravado no run. */
function juizDoRun(etapas: RunEtapa[], run: Run): EntradaDaClassificacao["juiz"] {
  if (etapas.some((e) => e.tipo === "juiz" && e.status === "falhou")) return "indisponivel"
  if (run.juiz_aprovado === null) return undefined
  return run.juiz_aprovado ? "aprovado" : "reprovado"
}

/** Sinais do run para classificar o caso. Sem `r` (pausa acima do teto), a entrega não foi validada. */
function entradaDoRun(
  metricas: MetricaVista[],
  run: Run,
  etapas: RunEtapa[],
  r?: ResultadoDoRun,
): Corpo["entrada"] {
  return {
    etapas,
    ...sinaisDeErroDoLlm(metricas, run.status),
    juiz: juizDoRun(etapas, run),
    validouOk: r?.validacoes.includes("ok") ?? false,
    chamadasDeDecisao: r?.chamadasDeModelo ?? 0,
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

/** Caso falho por pausa acima do teto ou por falha de rota: as expectativas contam como não cumpridas. */
function falhasDoCaso(caso: {
  deve: { descricao: string }[]
  naoPode: { descricao: string }[]
}): Checagem[] {
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

/** Roda a passada e devolve a rodada, ou a falha da rota quando o `falha` da composição a reconhece. */
async function passar<R extends RodadaDoCenario>(
  deps: DepsDoCenario,
  contaId: string,
  cenario: CenarioDaRodada,
  responder: OpcoesDaRodada["responder"],
  comp: Composicao<R>,
): Promise<{ rodada: R } | { falha: FalhaDaRodada }> {
  const rodar: Rodador<R> = comp.rodar ?? ((d, c, s, o) => rodarCenario(d, c, s, o) as Promise<R>)
  try {
    return { rodada: await rodar(deps, contaId, cenario, { responder }) }
  } catch (erro) {
    const falha = await comp.falha?.(erro, deps, contaId)
    if (falha === undefined) throw erro
    return { falha }
  }
}

/** Caso que falhou numa rota: `falhou` sem classificação, com as expectativas como não cumpridas. */
async function casoFalhou(
  caso: {
    id: string
    titulo: string
    familias: FamiliaMarcada[]
    marcas?: Marca[]
    deve: { descricao: string }[]
    naoPode: { descricao: string }[]
  },
  tipo: TipoDeCaso,
  falha: FalhaDaRodada,
  p: { deps: DepsDoCenario; contaId: string; latenciaMs: number; mensagem?: string },
): Promise<CasoRodado> {
  const etapas =
    falha.runId === undefined ? [] : await p.deps.stores.runs.etapas(p.contaId, falha.runId)
  const resultado = montar(caso, tipo, {
    checagens: [...falhasDoCaso(caso), ...falha.checagens],
    uso: {},
    trocas: 0,
    modelos: [],
    latenciaMs: p.latenciaMs,
    erro: falha.erro,
    falhou: true,
    entrada: { etapas: [], houveCotaOu429: false, validouOk: false, chamadasDeDecisao: 0 },
  })
  return { resultado, colhido: colhidoSemSaida(p.mensagem, etapas) }
}

/** Um caso de acompanhante. A pessoa do eval pula cada pergunta e o run segue até o fim. Pausa acima do teto falha o caso. */
export async function rodarAcompanhante<R extends RodadaDoCenario = RodadaDoCenario>(
  caso: CasoC1,
  opts: { runtime: AgentRuntime; telemetria?: Telemetry } & Composicao<R>,
): Promise<CasoRodado> {
  const cenario = { ...cenarioDoRunner(caso.cenario), roteiro: [] }
  const { contaId, deps } = await montarCenario(cenario, opts)
  const inicio = performance.now()
  const passada = await passar(deps, contaId, cenario, async () => ({ tipo: "pular" }), opts)
  const latenciaMs = Math.round(performance.now() - inicio)
  const mensagem = cenario.mensagem?.texto ?? cenario.entrada?.texto
  if ("falha" in passada) {
    return casoFalhou(caso, "acompanhante", passada.falha, { deps, contaId, latenciaMs, mensagem })
  }
  const rodada = passada.rodada
  const run = await lerRun(deps, contaId, rodada.final.run_id)
  const resposta = rodada.final
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
    checagens: [
      ...conferir("deve", caso.deve, r),
      ...conferir("nao_pode", caso.naoPode, r),
      ...(opts.extras?.(rodada, run) ?? []),
    ],
    run: parteDoRun({
      r,
      run,
      caminho: run.caminho,
      trajetoria: caso.trajetoria,
      violacoes: violacoesDaPrimeiraEntrega(deps.telemetry.spans, deps.telemetry.metricas),
      perguntasFeitas: rodada.perguntas.length,
      contagem: contarEtapas(etapas),
    }),
    uso: usoDoRun(deps.telemetry.metricas),
    trocas: run.trocas_de_modelo,
    modelos: modelosDoRun(run.modelos),
    latenciaMs,
    entrada: entradaDoRun(deps.telemetry.metricas, run, etapas, r),
  })
  return { resultado, colhido: colhidoDoRun(mensagem, saida, etapas) }
}

/** Uma mensagem pela conversa, respondendo às pausas com as respostas do caso. Sem juiz: a explicação fica fora desta conta. */
export async function rodarConversa<R extends RodadaDoCenario = RodadaDoCenario>(
  caso: CasoConversa,
  opts: { runtime: AgentRuntime; llm: LlmClient; telemetria?: Telemetry } & Composicao<R>,
): Promise<CasoRodado> {
  const cenario = { ...cenarioDoRunner(caso.cenario), roteiro: [] }
  const { contaId, deps } = await montarCenario(cenario, opts)
  const inicio = performance.now()
  const passada = await passar(
    deps,
    contaId,
    cenario,
    async (pergunta, i) => resolverResposta(caso.respostas?.[i], pergunta),
    opts,
  )
  const latenciaMs = Math.round(performance.now() - inicio)
  const mensagem = cenario.mensagem?.texto
  if ("falha" in passada) {
    return casoFalhou(caso, "conversa", passada.falha, { deps, contaId, latenciaMs, mensagem })
  }
  const rodada = passada.rodada
  const resposta = daConversa(rodada.final)
  const run = await lerRun(deps, contaId, resposta.run_id)
  const etapas = await deps.stores.runs.etapas(contaId, resposta.run_id)
  const extras = opts.extras?.(rodada, run) ?? []
  // Ainda pausado depois do teto de retomadas: o caso falha com o motivo, sem run, e a rodada segue.
  if (resposta.status === "waiting_for_input") {
    return {
      resultado: montar(caso, "conversa", {
        checagens: [...falhasDoCaso(caso), ...extras],
        uso: {},
        trocas: 0,
        modelos: [],
        latenciaMs,
        erro: MOTIVO_PAUSA_ACIMA_DO_TETO,
        entrada: entradaDoRun(deps.telemetry.metricas, run, etapas),
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
    checagens: [
      ...conferir("deve", caso.deve, alvo),
      ...conferir("nao_pode", caso.naoPode, alvo),
      ...extras,
    ],
    run: parteDoRun({
      r,
      run,
      caminho: resposta.caminho,
      violacoes: violacoesDaPrimeiraEntrega(deps.telemetry.spans, deps.telemetry.metricas),
      perguntasFeitas: perguntas.length,
      contagem,
    }),
    uso: usoDoRun(deps.telemetry.metricas),
    trocas: run.trocas_de_modelo,
    modelos: modelosDoRun(run.modelos),
    latenciaMs,
    entrada: entradaDoRun(deps.telemetry.metricas, run, etapas, r),
  })
  return { resultado, colhido: colhidoDoRun(mensagem, saida, etapas) }
}
