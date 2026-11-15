// Laço da rodada do eval com LLM, puro: o caso real entra por injeção. Guarda o que tem.
import { SemModeloError } from "../../src/core/llm/chamar"
import { LlmError } from "../../src/core/llm/errors"
import type { Explicacao, ResultadoDoCaso, Rodada } from "./eval-llm-report"

export type CasoDaRodada = {
  id: string
  titulo: string
  deve: { descricao: string }[]
  naoPode: { descricao: string }[]
}

export const ehParada = (e: unknown): boolean =>
  e instanceof SemModeloError || (e instanceof LlmError && e.code === "rate_limit")

/** Falha da chamada de apoio não derruba o caso: a explicação fica "não avaliada". Parada da rodada sobe. */
export async function resolverExplicacao<T extends { dado: Explicacao }>(
  chamar: () => Promise<T>,
): Promise<T | { naoAvaliada: true }> {
  try {
    return await chamar()
  } catch (e) {
    if (ehParada(e) || !(e instanceof LlmError)) throw e
    return { naoAvaliada: true }
  }
}

/** Só a classe ou o código: nunca a mensagem, que pode trazer texto da pessoa ou dado do driver. */
export function codigoDoErro(e: unknown): string {
  if (e instanceof LlmError) return `LlmError:${e.code}`
  return e instanceof Error ? e.constructor.name : "desconhecido"
}

function casoComErro(caso: CasoDaRodada, erro: string): ResultadoDoCaso {
  return {
    id: caso.id,
    titulo: caso.titulo,
    deve: caso.deve.map((x) => ({ descricao: x.descricao, ok: false })),
    naoPode: caso.naoPode.map((x) => ({ descricao: x.descricao, ok: false })),
    trajetoriaOk: false,
    chamadasDesnecessarias: 0,
    validaNa1a: false,
    houveViolacao: false,
    corrigiuAposViolacao: false,
    erro,
    uso: {},
    trocas: 0,
    latenciaMs: 0,
    modelos: [],
  }
}

export async function executarRodada<C extends CasoDaRodada>(p: {
  checkpoint: string
  promptVersao: string
  casos: C[]
  rodarCaso: (caso: C) => Promise<ResultadoDoCaso>
  pausaMs: number
  log?: (linha: string) => void
}): Promise<Rodada> {
  const log = p.log ?? console.log
  const rodada: Rodada = {
    checkpoint: p.checkpoint,
    promptVersao: p.promptVersao,
    casos: [],
    totalDeCasos: p.casos.length,
  }
  for (const caso of p.casos) {
    try {
      rodada.casos.push(await p.rodarCaso(caso))
      log(`${caso.id}  ok`)
    } catch (e) {
      if (ehParada(e)) {
        rodada.interrompidaPor = `sem modelo ou 429 persistente no caso ${caso.id}`
        break
      }
      const codigo = codigoDoErro(e)
      rodada.casos.push(casoComErro(caso, codigo))
      log(`${caso.id}  erro (${codigo})`)
    }
    if (p.pausaMs > 0) await new Promise((r) => setTimeout(r, p.pausaMs))
  }
  return rodada
}
