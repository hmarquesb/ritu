// Avaliador do eval: responde sim ou não às perguntas de explicação, fidelidade e critérios de um caso,
// numa chamada do papel `apoio`. Sem container: as dependências entram por parâmetro.
import { z } from "zod"
import { avaliadorV1 } from "../../../evals/llm/avaliador.v1"
import type { CasoDeEval } from "../../../evals/llm/casos"
import type { Criterio } from "../../../evals/llm/tipos"
import type {
  SaidaDoAcompanhante,
  SugestaoEntregue,
} from "../../../src/core/agents/companion/saida"
import { linhaParaOJuiz } from "../../../src/core/agents/judge/entrada"
import type { Clock } from "../../../src/core/clock"
import type { KnowledgeBase } from "../../../src/core/knowledge/knowledge-base"
import { chamarComPapel } from "../../../src/core/llm/chamar"
import type { LlmClient } from "../../../src/core/llm/client"
import { LlmError } from "../../../src/core/llm/errors"
import type { ModelRouter } from "../../../src/core/llm/router"
import type { Telemetry } from "../../../src/core/telemetry/ports"
import { type Colhido, calcularAcertou, type ResultadoDoCaso, type UsoDoPapel } from "./resultado"

export const respostaDoAvaliadorSchema = z.object({
  respostas: z.array(z.object({ n: z.number().int().positive(), sim: z.boolean() })),
})

export type Pergunta = {
  n: number
  origem: "explicacao" | "texto_bate" | "motivo" | "criterio"
  indice?: number
  pergunta: string
  /** Só em `criterio`: o critério do caso, para conferir a resposta. */
  criterio?: Criterio
}

export type DepsDoAvaliador = {
  router: ModelRouter
  client: LlmClient
  telemetry: Telemetry
  clock: Clock
  kb: KnowledgeBase
}

type Avaliado = { respostas: Map<number, boolean>; uso: UsoDoPapel; trocas: number; modelo: string }

const PERGUNTAS_DE_EXPLICACAO = [
  "A resposta diz o que o momento da pessoa pede?",
  "A resposta diz o que cada item sugerido traz?",
  "A resposta diz por que os itens combinam com o momento?",
]
const PERGUNTA_DO_TEXTO = "O texto recomenda as mesmas coisas que a lista de sugestões?"

type SemN = Omit<Pergunta, "n">

/** Linhas da base citadas numa sugestão: as de `linhas_base` e as de cada item, sem vazias. */
function linhasCitadas(s: SugestaoEntregue): string[] {
  return [...s.linhas_base, ...s.itens.map((i) => i.linha_base)].filter((ref) => ref !== "")
}

function perguntasFixas(caso: CasoDeEval, saida?: SaidaDoAcompanhante): SemN[] {
  if (saida?.origem !== "agente") return []
  const perguntas: SemN[] = []
  if (caso.familias.includes("explicacao")) {
    PERGUNTAS_DE_EXPLICACAO.forEach((pergunta, indice) => {
      perguntas.push({ origem: "explicacao", indice, pergunta })
    })
  }
  if (caso.familias.includes("fidelidade")) {
    perguntas.push({ origem: "texto_bate", pergunta: PERGUNTA_DO_TEXTO })
    saida.sugestoes.forEach((s, indice) => {
      if (linhasCitadas(s).length === 0) return
      perguntas.push({
        origem: "motivo",
        indice,
        pergunta: `O motivo da sugestão ${indice + 1} diz o mesmo que as linhas da base citadas nela?`,
      })
    })
  }
  return perguntas
}

function perguntasDeCriterio(caso: CasoDeEval): SemN[] {
  return (caso.criterios ?? []).map((criterio, indice) => ({
    origem: "criterio",
    indice,
    pergunta: criterio.pergunta,
    criterio,
  }))
}

/** Perguntas do caso, numeradas a partir de 1: fixas (explicação e fidelidade), depois os critérios. */
export function montarPerguntas(caso: CasoDeEval, saida?: SaidaDoAcompanhante): Pergunta[] {
  return [...perguntasFixas(caso, saida), ...perguntasDeCriterio(caso)].map((p, i) => ({
    n: i + 1,
    ...p,
  }))
}

/** `<` e `>` do conteúdo viram `‹` e `›`, para o conteúdo não fechar um bloco. */
function neutro(texto: string): string {
  return texto.replace(/</g, "‹").replace(/>/g, "›")
}

function bloco(nome: string, linhas: string[]): string | undefined {
  const conteudo = linhas.filter((l) => l.trim() !== "")
  if (conteudo.length === 0) return undefined
  return `<${nome}>\n${neutro(conteudo.join("\n"))}\n</${nome}>`
}

function linhasDaBaseCitadas(s: SugestaoEntregue, kb: KnowledgeBase): string[] {
  const refs = [...new Set(linhasCitadas(s))]
  return refs.flatMap((ref) => {
    const linha = linhaParaOJuiz(ref, kb)
    return linha === undefined ? [] : [`${ref}: ${linha}`]
  })
}

function linhasDasSugestoes(saida: SaidaDoAcompanhante | undefined, kb: KnowledgeBase): string[] {
  return (saida?.sugestoes ?? []).flatMap((s, i) => {
    const nomes = s.itens.map((it) => it.nome).join(", ")
    const cabeca = `${i + 1}. ${s.titulo}. Itens: ${nomes}. Motivo: ${s.motivo}`
    return [cabeca, ...linhasDaBaseCitadas(s, kb)]
  })
}

/** Entrada do avaliador: blocos `<mensagem>`, `<resposta>`, `<sugestoes>` e `<perguntas>`, os vazios não entram. */
export function montarEntradaDoAvaliador(p: {
  mensagem?: string
  texto: string
  saida?: SaidaDoAcompanhante
  kb: KnowledgeBase
  perguntas: Pergunta[]
}): string {
  const blocos = [
    bloco("mensagem", p.mensagem === undefined ? [] : [p.mensagem]),
    bloco("resposta", [p.texto]),
    bloco("sugestoes", linhasDasSugestoes(p.saida, p.kb)),
    bloco(
      "perguntas",
      p.perguntas.map((q) => `${q.n}. ${q.pergunta}`),
    ),
  ]
  return blocos.filter((b): b is string => b !== undefined).join("\n\n")
}

/** Respostas válidas por número: sem as faltantes, as repetidas e as de número fora das perguntas. */
function respostasPorNumero(
  respostas: { n: number; sim: boolean }[],
  perguntas: Pergunta[],
): Map<number, boolean> {
  const contagem = new Map<number, number>()
  for (const r of respostas) contagem.set(r.n, (contagem.get(r.n) ?? 0) + 1)
  const numeros = new Set(perguntas.map((p) => p.n))
  const mapa = new Map<number, boolean>()
  for (const r of respostas) {
    if (numeros.has(r.n) && contagem.get(r.n) === 1) mapa.set(r.n, r.sim)
  }
  return mapa
}

/** Chama o papel `apoio` com as perguntas do caso. Erro que não é `rate_limit` vira `naoAvaliado`. */
export async function avaliar(
  deps: DepsDoAvaliador,
  caso: CasoDeEval,
  colhido: Colhido,
): Promise<Avaliado | { naoAvaliado: true }> {
  const perguntas = montarPerguntas(caso, colhido.saida)
  const entrada = montarEntradaDoAvaliador({
    mensagem: colhido.mensagem,
    texto: colhido.texto,
    saida: colhido.saida,
    kb: deps.kb,
    perguntas,
  })
  try {
    const r = await chamarComPapel(
      { router: deps.router, client: deps.client, telemetry: deps.telemetry },
      {
        papel: "apoio",
        instrucoes: avaliadorV1.instrucoes,
        entrada,
        schema: respostaDoAvaliadorSchema,
      },
    )
    return {
      respostas: respostasPorNumero(r.dado.respostas, perguntas),
      uso: { chamadas: 1, tokens_entrada: r.tokens.entrada, tokens_saida: r.tokens.saida },
      trocas: r.trocas,
      modelo: r.modelo,
    }
  } catch (e) {
    if (e instanceof LlmError && e.code !== "rate_limit") return { naoAvaliado: true }
    throw e
  }
}

function valorDe(
  perguntas: Pergunta[],
  respostas: Map<number, boolean>,
  filtro: (p: Pergunta) => boolean,
): boolean | null {
  const pergunta = perguntas.find(filtro)
  if (pergunta === undefined) return null
  return respostas.get(pergunta.n) ?? null
}

function avaliacaoDasPerguntas(
  perguntas: Pergunta[],
  respostas: Map<number, boolean>,
): ResultadoDoCaso["avaliacao"] {
  const temAlguma = perguntas.some((p) => p.origem !== "criterio")
  if (!temAlguma) return undefined
  const motivos = perguntas.filter((p) => p.origem === "motivo")
  const tamanho = motivos.reduce((max, p) => Math.max(max, (p.indice ?? 0) + 1), 0)
  return {
    explicacao: [0, 1, 2].map((indice) =>
      valorDe(perguntas, respostas, (p) => p.origem === "explicacao" && p.indice === indice),
    ),
    textoBate: valorDe(perguntas, respostas, (p) => p.origem === "texto_bate"),
    motivos: Array.from({ length: tamanho }, (_, indice) =>
      valorDe(perguntas, respostas, (p) => p.origem === "motivo" && p.indice === indice),
    ),
  }
}

/** Junta a avaliação ao resultado do caso: avaliação, critérios, uso do avaliador, trocas, modelos e `acertou`. */
export function aplicarAvaliacao(
  r: ResultadoDoCaso,
  perguntas: Pergunta[],
  avaliado: Avaliado | { naoAvaliado: true },
): ResultadoDoCaso {
  const respostas = "naoAvaliado" in avaliado ? new Map<number, boolean>() : avaliado.respostas
  const criterios = perguntas.flatMap((p) => {
    if (p.origem !== "criterio" || p.criterio === undefined) return []
    const resposta = respostas.get(p.n)
    return [
      {
        lista: "criterio" as const,
        descricao: p.criterio.descricao,
        ok: resposta === undefined ? null : resposta === p.criterio.esperado,
      },
    ]
  })
  const avaliacao = avaliacaoDasPerguntas(perguntas, respostas)
  const checagens = [...r.checagens, ...criterios]
  const ehAvaliado = !("naoAvaliado" in avaliado)
  const modelos =
    ehAvaliado && !r.modelos.includes(avaliado.modelo) ? [...r.modelos, avaliado.modelo] : r.modelos
  const atualizado: ResultadoDoCaso = {
    ...r,
    checagens,
    avaliacao,
    trocas: r.trocas + (ehAvaliado ? avaliado.trocas : 0),
    modelos,
    acertou: false,
  }
  if (ehAvaliado) atualizado.usoDoAvaliador = avaliado.uso
  atualizado.acertou = calcularAcertou(atualizado)
  return atualizado
}
