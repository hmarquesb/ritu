import { config } from "@config/index"
import { z } from "zod"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Funcao } from "@/core/knowledge/vocab"
import type { Candidato, EstadoNaCasa, ItemDoCandidato } from "@/core/ranking/tipos"
import {
  type Pergunta,
  perguntaSchema,
  type RespostaDaPessoa,
  type RespostaDeCasa,
} from "@/core/runs/pergunta"
import { type EntradaDoAcompanhante, entradaDoAcompanhanteSchema } from "./entrada"
import { type DadosDoPreparo, entregaveis } from "./preparo"
import { type Anotacao, anotacaoSchema } from "./saida"

// Conteúdo da pendência de pergunta (Pendencia.conteudo, com tipo "pergunta").
export type ConteudoDaPendencia =
  | { origem: "agente"; pergunta: Pergunta; anotacoes?: Anotacao[] }
  | { origem: "codigo"; pergunta: Pergunta; entrada: EntradaDoAcompanhante; anotacoes?: Anotacao[] }

export const conteudoDaPendenciaSchema: z.ZodType<ConteudoDaPendencia> = z.discriminatedUnion(
  "origem",
  [
    z.object({
      origem: z.literal("agente"),
      pergunta: perguntaSchema,
      anotacoes: z.array(anotacaoSchema).optional(),
    }),
    z.object({
      origem: z.literal("codigo"),
      pergunta: perguntaSchema,
      entrada: entradaDoAcompanhanteSchema,
      anotacoes: z.array(anotacaoSchema).optional(),
    }),
  ],
)

type ItemRespondido = { alimento_id: string; resposta: RespostaDeCasa }
type RespostaDeCasaDaPessoa = Extract<RespostaDaPessoa, { tipo: "casa" }>

const semId = (ids: string[], id: string): string[] => ids.filter((x) => x !== id)
const comId = (ids: string[], id: string): string[] => (ids.includes(id) ? ids : [...ids, id])

function marcarItem(item: ItemDoCandidato, id: string, casa: EstadoNaCasa): ItemDoCandidato {
  return item.alimento_id === id ? { ...item, casa } : item
}

function marcarCandidato(c: Candidato, id: string, casa: EstadoNaCasa): Candidato {
  const marcar = (item: ItemDoCandidato) => marcarItem(item, id, casa)
  if (!c.opcoes) return { ...c, itens: c.itens.map(marcar) }
  const opcoes: NonNullable<Candidato["opcoes"]> = {}
  for (const funcao of Object.keys(c.opcoes) as Funcao[]) {
    opcoes[funcao] = c.opcoes[funcao]?.map(marcar)
  }
  return { ...c, itens: c.itens.map(marcar), opcoes }
}

function aplicarItem(
  dados: DadosDoPreparo,
  { alimento_id: id, resposta }: ItemRespondido,
): DadosDoPreparo {
  const { confirmados, incertos } = dados.casa
  if (resposta === "tenho") {
    return {
      ...dados,
      casa: { confirmados: comId(confirmados, id), incertos: semId(incertos, id) },
      candidatos: dados.candidatos.map((c) => marcarCandidato(c, id, "confirmado")),
    }
  }
  if (resposta === "nao_tenho") {
    return {
      ...dados,
      casa: { confirmados, incertos: semId(incertos, id) },
      candidatos: dados.candidatos.map((c) => marcarCandidato(c, id, "ausente")),
      nao_tem_do_run: comId(dados.nao_tem_do_run, id),
    }
  }
  return {
    ...dados,
    casa: { confirmados: semId(confirmados, id), incertos: semId(incertos, id) },
    filtro: { ...dados.filtro, nao_gosta: comId(dados.filtro.nao_gosta, id) },
  }
}

// Depois de uma resposta de casa, a refeição é conferida de novo. Alimento perguntado que não ficou em casa é "acabou".
function aplicarCasa(
  dados: DadosDoPreparo,
  respostas: RespostaDeCasaDaPessoa,
  kb: KnowledgeBase,
): DadosDoPreparo {
  const aplicado = respostas.itens.reduce(aplicarItem, dados)
  const alimentos = respostas.itens.reduce(
    (ids, item) => comId(ids, item.alimento_id),
    dados.perguntas.alimentos,
  )
  const perguntadosFora = alimentos.filter(
    (id) => !aplicado.casa.confirmados.includes(id) && !aplicado.casa.incertos.includes(id),
  )
  const acabou = [...new Set([...dados.acabou, ...perguntadosFora])]
  const atual: DadosDoPreparo = {
    ...aplicado,
    perguntas: { ...dados.perguntas, alimentos },
    acabou,
  }
  const candidatos = entregaveis(
    atual.candidatos,
    {
      casa: atual.casa,
      acabou,
      perguntasRestantes: config.pausas.maxPerguntasPorRun - atual.perguntas.feitas,
    },
    kb,
  )
  return { ...atual, candidatos }
}

function aplicarNaoCome(dados: DadosDoPreparo, id: string): DadosDoPreparo {
  return {
    ...dados,
    filtro: { ...dados.filtro, nao_come: comId(dados.filtro.nao_come, id) },
    nao_come_do_run: comId(dados.nao_come_do_run, id),
  }
}

// Pura: devolve os dados do run com a resposta aplicada. "Como", "pular" e variante não mudam nada.
export function aplicarResposta(
  dados: DadosDoPreparo,
  pergunta: Pergunta,
  resposta: RespostaDaPessoa,
  kb: KnowledgeBase,
): DadosDoPreparo {
  if (resposta.tipo === "casa" && pergunta.tipo === "casa") return aplicarCasa(dados, resposta, kb)
  if (pergunta.tipo === "come" && resposta.tipo === "come" && resposta.resposta === "nao_como") {
    return aplicarNaoCome(dados, pergunta.alimento_id)
  }
  return dados
}

// Ids que estavam nos candidatos antes e saíram depois, na ordem.
export function candidatosRetirados(antes: DadosDoPreparo, depois: DadosDoPreparo): string[] {
  const ficaram = new Set(depois.candidatos.map((c) => c.id))
  return antes.candidatos.map((c) => c.id).filter((id) => !ficaram.has(id))
}
