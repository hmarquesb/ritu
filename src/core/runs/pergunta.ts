import { z } from "zod"
import { RituError } from "@/core/errors"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { juntarNomes } from "@/core/knowledge/lacunas"
import type { MomentoQualidades } from "@/core/knowledge/momento"
import { ROTULOS_DA_RESPOSTA, TEXTOS_DA_PERGUNTA } from "./pergunta-textos"

export type RespostaDeCasa = "tenho" | "nao_tenho" | "nao_gosto"

export type Pergunta =
  | { tipo: "casa"; texto: string; itens: { alimento_id: string; nome: string }[] }
  | { tipo: "come"; texto: string; alimento_id: string; nome: string }
  | { tipo: "variante"; texto: string; incomodo: string; opcoes: { id: string; texto: string }[] }

export type RespostaDaPessoa =
  | { tipo: "casa"; itens: { alimento_id: string; resposta: RespostaDeCasa }[] } // item ausente da lista: pulou
  | { tipo: "come"; resposta: "como" | "nao_como" }
  | { tipo: "variante"; variante: string }
  | { tipo: "pular" }

export type RetomadaDaPergunta = {
  pergunta: Pergunta
  resposta: RespostaDaPessoa
  candidatos_retirados: string[]
}

type PerguntaDeCasa = Extract<Pergunta, { tipo: "casa" }>
type RespostaDeCasaDaPessoa = Extract<RespostaDaPessoa, { tipo: "casa" }>

const itemDeCasaSchema = z.object({ alimento_id: z.string(), nome: z.string() })
const opcaoSchema = z.object({ id: z.string(), texto: z.string() })

export const perguntaSchema: z.ZodType<Pergunta> = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("casa"), texto: z.string(), itens: z.array(itemDeCasaSchema) }),
  z.object({
    tipo: z.literal("come"),
    texto: z.string(),
    alimento_id: z.string(),
    nome: z.string(),
  }),
  z.object({
    tipo: z.literal("variante"),
    texto: z.string(),
    incomodo: z.string(),
    opcoes: z.array(opcaoSchema),
  }),
])

export const respostaDaPessoaSchema: z.ZodType<RespostaDaPessoa> = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("casa"),
    itens: z.array(
      z.object({
        alimento_id: z.string(),
        resposta: z.enum(["tenho", "nao_tenho", "nao_gosto"]),
      }),
    ),
  }),
  z.object({ tipo: z.literal("come"), resposta: z.enum(["como", "nao_como"]) }),
  z.object({ tipo: z.literal("variante"), variante: z.string() }),
  z.object({ tipo: z.literal("pular") }),
])

function respostaDeCasaValida(pergunta: PerguntaDeCasa, resposta: RespostaDeCasaDaPessoa): boolean {
  const idsDaPergunta = pergunta.itens.map((item) => item.alimento_id)
  const idsRespondidos = resposta.itens.map((item) => item.alimento_id)
  const todosDaPergunta = idsRespondidos.every((id) => idsDaPergunta.includes(id))
  const semRepetir = new Set(idsRespondidos).size === idsRespondidos.length
  return todosDaPergunta && semRepetir
}

export function validarResposta(pergunta: Pergunta, resposta: RespostaDaPessoa): boolean {
  if (resposta.tipo === "pular") return true
  if (resposta.tipo !== pergunta.tipo) return false
  if (pergunta.tipo === "casa" && resposta.tipo === "casa") {
    return respostaDeCasaValida(pergunta, resposta)
  }
  if (pergunta.tipo === "variante" && resposta.tipo === "variante") {
    return pergunta.opcoes.some((opcao) => opcao.id === resposta.variante)
  }
  return pergunta.tipo === "come"
}

function nomeDoAlimento(id: string, kb: KnowledgeBase): string {
  const alimento = kb.alimento(id)
  if (!alimento) throw new RituError("fora_da_base", "Alimento fora da base")
  return alimento.nome
}

function perguntaDeCasa(
  p: { alimentos: string[]; incertos: string[] },
  kb: KnowledgeBase,
): PerguntaDeCasa {
  const itens = p.alimentos.map((id) => ({ alimento_id: id, nome: nomeDoAlimento(id, kb) }))
  const todosIncertos = p.alimentos.every((id) => p.incertos.includes(id))
  const modelo = todosIncertos ? TEXTOS_DA_PERGUNTA.casaAindaTem : TEXTOS_DA_PERGUNTA.casaVoceTem
  const texto = modelo.replace("{itens}", () => juntarNomes(itens.map((item) => item.nome)))
  return { tipo: "casa", texto, itens }
}

export function montarPergunta(
  p: { tipo: "casa"; alimentos: string[]; incertos: string[] } | { tipo: "come"; alimento: string },
  kb: KnowledgeBase,
): Pergunta {
  if (p.tipo === "casa") return perguntaDeCasa(p, kb)
  const nome = nomeDoAlimento(p.alimento, kb)
  const texto = TEXTOS_DA_PERGUNTA.come.replace("{item}", () => nome.toLowerCase())
  return { tipo: "come", texto, alimento_id: p.alimento, nome }
}

export function perguntaDaVariante(
  precisa: NonNullable<MomentoQualidades["precisa_variante"]>,
): Pergunta {
  return {
    tipo: "variante",
    texto: precisa.pergunta,
    incomodo: precisa.incomodo,
    opcoes: precisa.opcoes.map((opcao) => ({ id: opcao.id, texto: opcao.texto })),
  }
}

const GRUPOS_DE_CASA: { resposta: RespostaDeCasa; rotulo: string }[] = [
  { resposta: "tenho", rotulo: ROTULOS_DA_RESPOSTA.tenho },
  { resposta: "nao_tenho", rotulo: ROTULOS_DA_RESPOSTA.nao_tenho },
  { resposta: "nao_gosto", rotulo: ROTULOS_DA_RESPOSTA.nao_gosto },
]

function textoDeCasa(pergunta: Pergunta, resposta: RespostaDeCasaDaPessoa): string {
  const nomes = new Map(
    pergunta.tipo === "casa" ? pergunta.itens.map((i) => [i.alimento_id, i.nome]) : [],
  )
  const grupos = GRUPOS_DE_CASA.flatMap(({ resposta: alvo, rotulo }) => {
    const doGrupo = resposta.itens
      .filter((item) => item.resposta === alvo)
      .map((item) => nomes.get(item.alimento_id) ?? "")
    return doGrupo.length > 0 ? [`${rotulo}: ${juntarNomes(doGrupo)}`] : []
  })
  return grupos.length > 0 ? grupos.join(" · ") : ROTULOS_DA_RESPOSTA.pular
}

function textoDeVariante(pergunta: Pergunta, variante: string): string {
  const opcao =
    pergunta.tipo === "variante" ? pergunta.opcoes.find((o) => o.id === variante) : undefined
  return opcao?.texto ?? ROTULOS_DA_RESPOSTA.pular
}

export function textoDaResposta(pergunta: Pergunta, resposta: RespostaDaPessoa): string {
  if (resposta.tipo === "pular") return ROTULOS_DA_RESPOSTA.pular
  if (resposta.tipo === "come") return ROTULOS_DA_RESPOSTA[resposta.resposta]
  if (resposta.tipo === "variante") return textoDeVariante(pergunta, resposta.variante)
  return textoDeCasa(pergunta, resposta)
}
