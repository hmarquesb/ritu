// Laço da rodada do eval com LLM: roda os casos um a um, salva o andamento depois de cada um e para na cota
// ou em erros seguidos. Puro: o caso real, o salvamento e a pausa entram por parâmetro.
import { evals } from "../../../config/evals"
import type { CasoDeEval } from "../../../evals/llm/casos"
import type { Clock } from "../../../src/core/clock"
import { SemModeloError } from "../../../src/core/llm/chamar"
import { LlmError } from "../../../src/core/llm/errors"
import type { Andamento } from "./andamento"
import { classificarCaso } from "./inconclusivo"
import { codigoDoErro, type ResultadoDoCaso } from "./resultado"

export type MotivoDaParada = "cota" | "erros_seguidos"

export type FimDaRodada = {
  fim: "completa" | "interrompida"
  motivo?: MotivoDaParada
  andamento: Andamento
  /** Id do caso em que a rodada parou. */
  parouEm?: string
}

export type ParametrosDaRodada = {
  checkpoint: string
  casos: CasoDeEval[]
  assinatura: string
  anterior?: Andamento
  rodarCaso: (caso: CasoDeEval) => Promise<ResultadoDoCaso>
  salvar: (a: Andamento) => Promise<void>
  esperar: (ms: number) => Promise<void>
  clock: Clock
  log?: (linha: string) => void
}

export const ehParada = (e: unknown): boolean =>
  e instanceof SemModeloError || (e instanceof LlmError && e.code === "rate_limit")

function chamadasDoCaso(r: ResultadoDoCaso): number {
  const dosPapeis = Object.values(r.uso).reduce((soma, uso) => soma + (uso?.chamadas ?? 0), 0)
  return dosPapeis + (r.usoDoAvaliador?.chamadas ?? 0)
}

/** Pausa para ficar abaixo do limite de chamadas por minuto, com um piso entre casos. */
function esperaDepois(r: ResultadoDoCaso, decorridoMs: number): number {
  return Math.max(evals.pausaMinimaMs, chamadasDoCaso(r) * evals.pausaPorChamadaMs - decorridoMs)
}

/**
 * Caso que falhou por outro motivo: sem checagens, com só o código do erro. Sem etapas, o erro é classificado
 * pelo código: banco, cota e timeout são inconclusivos; o resto, `sem_etapas`.
 */
function resultadoDeErro(caso: CasoDeEval, codigo: string): ResultadoDoCaso {
  const c = classificarCaso({
    erro: codigo,
    etapas: [],
    houveCotaOu429: false,
    validouOk: false,
    chamadasDeDecisao: 0,
  })
  return {
    id: caso.id,
    titulo: caso.titulo,
    tipo: caso.tipo,
    familias: caso.familias,
    marcas: caso.marcas ?? [],
    checagens: [],
    acertou: false,
    estado: c.estado,
    ...(c.inconclusivo === undefined ? {} : { inconclusivo: c.inconclusivo }),
    uso: {},
    trocas: 0,
    latenciaMs: 0,
    modelos: [],
    erro: codigo,
  }
}

function linhaDoCaso(r: ResultadoDoCaso): string {
  if (r.erro !== undefined) return `${r.id}  erro (${r.erro})`
  return `${r.id}  ${r.acertou ? "ok" : "errado"}`
}

type ResultadoDoTempo = { cota: true } | { resultado: ResultadoDoCaso; decorridoMs: number }

/** Roda um caso e mede a duração. Limite de cota vira `{ cota: true }`; outro erro vira resultado de erro. */
async function rodarMedido(p: ParametrosDaRodada, caso: CasoDeEval): Promise<ResultadoDoTempo> {
  const inicio = p.clock.now().getTime()
  try {
    const resultado = await p.rodarCaso(caso)
    return { resultado, decorridoMs: p.clock.now().getTime() - inicio }
  } catch (e) {
    if (ehParada(e)) return { cota: true }
    const decorridoMs = p.clock.now().getTime() - inicio
    return { resultado: resultadoDeErro(caso, codigoDoErro(e)), decorridoMs }
  }
}

export async function executarRodada(p: ParametrosDaRodada): Promise<FimDaRodada> {
  const porId = new Map<string, ResultadoDoCaso>(
    (p.anterior?.resultados ?? []).map((r) => [r.id, r]),
  )
  const iniciadaEm = p.anterior?.iniciada_em ?? p.clock.now().toISOString()

  const andamentoAtual = (): Andamento => ({
    versao: 1,
    checkpoint: p.checkpoint,
    assinatura: p.assinatura,
    iniciada_em: iniciadaEm,
    resultados: p.casos.flatMap((caso) => {
      const r = porId.get(caso.id)
      return r ? [r] : []
    }),
  })

  let errosSeguidos = 0
  for (const [indice, caso] of p.casos.entries()) {
    const feito = porId.get(caso.id)
    if (feito && feito.erro === undefined) continue

    const medido = await rodarMedido(p, caso)
    if ("cota" in medido)
      return { fim: "interrompida", motivo: "cota", andamento: andamentoAtual(), parouEm: caso.id }

    porId.set(caso.id, medido.resultado)
    await p.salvar(andamentoAtual())
    p.log?.(linhaDoCaso(medido.resultado))

    errosSeguidos = medido.resultado.erro === undefined ? 0 : errosSeguidos + 1
    if (errosSeguidos >= evals.maxErrosSeguidos) {
      return {
        fim: "interrompida",
        motivo: "erros_seguidos",
        andamento: andamentoAtual(),
        parouEm: caso.id,
      }
    }
    if (indice < p.casos.length - 1)
      await p.esperar(esperaDepois(medido.resultado, medido.decorridoMs))
  }

  return { fim: "completa", andamento: andamentoAtual() }
}
