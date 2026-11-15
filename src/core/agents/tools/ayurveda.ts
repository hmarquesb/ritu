import { z } from "zod"
import { notaAdequacao } from "@/core/knowledge/adequacao"
import { checarCombinacao } from "@/core/knowledge/combinacoes"
import { passaNoFiltro } from "@/core/knowledge/filtros"
import { identificarAlimento } from "@/core/knowledge/identificar"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { type Alimento, efeitoSchema, type Pratica, type Preparo } from "@/core/knowledge/schemas"
import { substitutos } from "@/core/knowledge/substitutos"
import { verbosDasGunas } from "@/core/knowledge/verbos"
import {
  confiancaSchema,
  doshaSchema,
  type Estado,
  estadoSchema,
  type Funcao,
  funcaoSchema,
  type Guna,
  grupoSchema,
  gunaSchema,
  type MomentoDoDia,
  momentoDoDiaSchema,
  rasaSchema,
  vipakaSchema,
  viryaSchema,
} from "@/core/knowledge/vocab"
import { definirTool, type Tool, type ToolContext } from "@/core/tools/tool"

const TABELAS = { alimento: "alimentos", preparo: "preparos", pratica: "praticas" } as const

// ayurveda.alimento

const alimentoEntradaSchema = z.object({
  alimentos: z.array(z.string().min(1)).min(1).max(5),
})

const alimentoSaidaSchema = z.object({
  alimentos: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      grupo: grupoSchema,
      rasa: z.array(rasaSchema),
      virya: viryaSchema,
      vipaka: vipakaSchema,
      gunas: z.array(gunaSchema),
      verbos: z.array(z.string()),
      efeito: efeitoSchema,
      como_equilibrar: z.partialRecord(doshaSchema, z.string()),
      observacao: z.string().optional(),
      confianca: confiancaSchema,
      linha_base: z.string(),
    }),
  ),
  desconhecidos: z.array(z.string()),
})

function paraSaidaAlimento(alimento: Alimento, kb: KnowledgeBase) {
  return {
    id: alimento.id,
    nome: alimento.nome,
    grupo: alimento.grupo,
    rasa: alimento.rasa,
    virya: alimento.virya,
    vipaka: alimento.vipaka,
    gunas: alimento.gunas,
    verbos: verbosDasGunas(alimento.gunas, kb),
    efeito: alimento.efeito,
    como_equilibrar: alimento.como_equilibrar,
    observacao: alimento.observacao,
    confianca: alimento.confianca,
    linha_base: `alimentos:${alimento.id}`,
  }
}

// Mesmo alimento escrito de dois jeitos sai uma vez, na ordem da primeira aparição.
function identificarNomes(
  nomes: string[],
  kb: KnowledgeBase,
): { alimentos: Alimento[]; desconhecidos: string[] } {
  const achados = new Map<string, Alimento>()
  const desconhecidos: string[] = []
  for (const nome of nomes) {
    const identificado = identificarAlimento(nome, kb)
    const alimento = identificado.tipo === "alimento" ? kb.alimento(identificado.id) : undefined
    if (alimento) achados.set(alimento.id, alimento)
    else desconhecidos.push(nome)
  }
  return { alimentos: [...achados.values()], desconhecidos }
}

export const alimentoTool = definirTool({
  name: "ayurveda.alimento",
  description:
    "Consulte as qualidades e o efeito de alimentos citados pela pessoa ou que você pensa em sugerir.",
  input: alimentoEntradaSchema,
  output: alimentoSaidaSchema,
  executar({ alimentos }, ctx) {
    const { alimentos: achados, desconhecidos } = identificarNomes(alimentos, ctx.kb)
    return { alimentos: achados.map((a) => paraSaidaAlimento(a, ctx.kb)), desconhecidos }
  },
})

// ayurveda.candidatos

const tipoCandidatoSchema = z.enum(["alimento", "preparo", "pratica"])
type TipoCandidato = z.infer<typeof tipoCandidatoSchema>
type Item = Alimento | Preparo | Pratica

const LIMITE_PADRAO_CANDIDATOS = 5

const candidatosEntradaSchema = z.object({
  tipo: tipoCandidatoSchema,
  buscadas: z.array(gunaSchema).min(1).max(6),
  momento_do_dia: momentoDoDiaSchema.optional(),
  estados: z.array(estadoSchema).optional(),
  funcao: funcaoSchema.optional(),
  limite: z.number().int().min(1).max(10).optional(),
})

type CandidatosEntrada = z.infer<typeof candidatosEntradaSchema>

const candidatoSaidaSchema = z.object({
  tipo: tipoCandidatoSchema,
  id: z.string(),
  nome: z.string(),
  gunas: z.array(gunaSchema),
  contribui: z.array(gunaSchema),
  nota: z.number(),
  linha_base: z.string(),
})

const candidatosSaidaSchema = z.object({ candidatos: z.array(candidatoSaidaSchema) })

function itensDoTipo(tipo: TipoCandidato, kb: KnowledgeBase): Item[] {
  if (tipo === "alimento") return [...kb.alimentos]
  if (tipo === "preparo") return [...kb.preparos]
  return [...kb.praticas]
}

// Preparo e prática têm gunas próprias; preparo não tem efeito por dosha.
function gunasDoItem(item: Item): Guna[] {
  return "vagas" in item ? item.gunas_do_preparo : item.gunas
}

function efeitoDoItem(item: Item) {
  return "vagas" in item ? undefined : item.efeito
}

function contraindicadoPorEstado(item: Item, estados: Estado[]): boolean {
  return "contraindicacoes" in item && item.contraindicacoes.some((e) => estados.includes(e))
}

function servePeloMomento(item: Item, momento?: MomentoDoDia): boolean {
  if (!momento || !("momento" in item)) return true
  return item.momento.includes(momento)
}

function temFuncao(item: Item, funcao?: Funcao): boolean {
  if (!funcao || !("funcoes" in item)) return true
  return item.funcoes.includes(funcao)
}

function elegivel(item: Item, entrada: CandidatosEntrada, ctx: ToolContext): boolean {
  return (
    passaNoFiltro(item, ctx.filtro, ctx.kb).passa &&
    !contraindicadoPorEstado(item, entrada.estados ?? []) &&
    servePeloMomento(item, entrada.momento_do_dia) &&
    temFuncao(item, entrada.funcao)
  )
}

function candidatoDoItem(
  tipo: TipoCandidato,
  item: Item,
  entrada: CandidatosEntrada,
  ctx: ToolContext,
) {
  const { nota, contribui } = notaAdequacao(
    { gunas: gunasDoItem(item), efeito: efeitoDoItem(item) },
    entrada.buscadas,
    ctx.prakriti,
  )
  return {
    tipo,
    id: item.id,
    nome: item.nome,
    gunas: gunasDoItem(item),
    contribui,
    nota,
    linha_base: `${TABELAS[tipo]}:${item.id}`,
  }
}

function candidatosDaEntrada(entrada: CandidatosEntrada, ctx: ToolContext) {
  const tipo = entrada.tipo
  return itensDoTipo(tipo, ctx.kb)
    .filter((item) => elegivel(item, entrada, ctx))
    .map((item) => candidatoDoItem(tipo, item, entrada, ctx))
    .filter((c) => c.nota > 0)
    .sort((a, b) => b.nota - a.nota || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, entrada.limite ?? LIMITE_PADRAO_CANDIDATOS)
}

export const candidatosTool = definirTool({
  name: "ayurveda.candidatos",
  description:
    "Busque alimentos, preparos ou práticas que atendem às qualidades buscadas, já filtrados para a pessoa.",
  input: candidatosEntradaSchema,
  output: candidatosSaidaSchema,
  executar(entrada, ctx) {
    return { candidatos: candidatosDaEntrada(entrada, ctx) }
  },
})

// ayurveda.substitutos

const LIMITE_PADRAO_SUBSTITUTOS = 3

const substitutosEntradaSchema = z.object({
  alimento_id: z.string().min(1),
  funcao: funcaoSchema.optional(),
  preparo_id: z.string().min(1).optional(),
  outros_itens: z.array(z.string()).optional(),
  limite: z.number().int().min(1).max(5).optional(),
})

const substitutosSaidaSchema = z.object({
  substitutos: z.array(
    z.object({
      alimento_id: z.string(),
      nome: z.string(),
      em_comum: z.array(gunaSchema),
      em_casa: z.boolean(),
      motivo: z.string(),
      linha_base: z.string(),
    }),
  ),
  desconhecidos: z.array(z.string()),
})

export const substitutosTool = definirTool({
  name: "ayurveda.substitutos",
  description: "Ache um substituto para um ingrediente que a pessoa não tem ou não quer.",
  input: substitutosEntradaSchema,
  output: substitutosSaidaSchema,
  executar(entrada, ctx) {
    return {
      substitutos: substitutos(
        {
          alimento_id: entrada.alimento_id,
          funcao: entrada.funcao,
          preparo_id: entrada.preparo_id,
          outros_itens: entrada.outros_itens ?? [],
          filtro: ctx.filtro,
          sinais: ctx.sinais,
          limite: entrada.limite ?? LIMITE_PADRAO_SUBSTITUTOS,
        },
        ctx.kb,
      ),
      desconhecidos: ctx.kb.alimento(entrada.alimento_id) ? [] : [entrada.alimento_id],
    }
  },
})

// ayurveda.checar_combinacao

const checarEntradaSchema = z.object({
  itens: z.array(z.string().min(1)).min(2).max(8),
})

const checarSaidaSchema = z.object({
  compativel: z.boolean(),
  conflitos: z.array(
    z.object({
      itens: z.tuple([z.string(), z.string()]),
      motivo: z.string(),
      linha_base: z.string(),
    }),
  ),
  desconhecidos: z.array(z.string()),
})

export const checarCombinacaoTool = definirTool({
  name: "ayurveda.checar_combinacao",
  description: "Confira se os alimentos de uma sugestão combinam entre si antes de entregar.",
  input: checarEntradaSchema,
  output: checarSaidaSchema,
  executar({ itens }, ctx) {
    const { compativel, conflitos } = checarCombinacao(itens, ctx.kb)
    return {
      compativel,
      conflitos,
      desconhecidos: itens.filter((id) => ctx.kb.alimento(id) === undefined),
    }
  },
})

export const ayurvedaTools: Tool<unknown, unknown>[] = [
  alimentoTool,
  candidatosTool,
  substitutosTool,
  checarCombinacaoTool,
]
