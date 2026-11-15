import { z } from "zod"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { passosDoPreparo, tituloDoPreparo } from "@/core/knowledge/lacunas"
import { fraseDaTroca } from "@/core/knowledge/substitutos"
import { type Funcao, funcaoSchema, GUNAS, type Guna, gunaSchema } from "@/core/knowledge/vocab"
import type { RespostaSemModelo } from "@/core/llm/sem-modelo"
import { type Anotacao, anotacaoSchema } from "@/core/proposals/anotacao"
import type { EstadoNaCasa, ParaTer, TipoDeSugestao } from "@/core/ranking/tipos"
import type { DadosDoPreparo } from "./preparo"
import { textosDoAcompanhante } from "./textos"

export { type Anotacao, anotacaoSchema } from "@/core/proposals/anotacao"

const itemDaEntregaSchema = z.object({
  alimento_id: z.string(),
  funcao: funcaoSchema.optional(),
  contribui: z.array(gunaSchema),
  linha_base: z.string(),
  se_faltar: z.string().optional(),
})

const sugestaoDaEntregaSchema = z.object({
  tipo: z.enum(["cha", "refeicao", "oleo", "pratica"]),
  pratica_id: z
    .string()
    .optional()
    .describe("Id de chá, óleo ou prática. Nunca junto com preparo_id."),
  preparo_id: z.string().optional().describe("Id de refeição. Nunca junto com pratica_id."),
  itens: z.array(itemDaEntregaSchema),
  motivo: z.string(),
  linhas_base: z.array(z.string()),
  novidade: z.boolean(),
})

// Entrada da tool finalizar. Sem tetos de tamanho nem de quantidade: quem aponta é o validador.
export const entregaDoModeloSchema = z.object({
  resposta: z.string(),
  explicacao: z.object({
    qualidades_do_momento: z
      .array(gunaSchema)
      .describe("Só as de qualidades.presentes do contexto (e as do clima)."),
    qualidades_buscadas: z.array(gunaSchema).describe("Só as de qualidades.buscadas do contexto."),
  }),
  sugestoes: z.array(sugestaoDaEntregaSchema),
  evitar: z
    .array(z.string())
    .describe("Só o linha_base dos itens de qualidades.evitar do contexto. Nunca texto livre."),
  incertos: z.array(z.string()),
  citados: z
    .array(z.string())
    .describe("Linhas completas tabela:id, como alimentos:arroz-branco. Nunca o id solto."),
  para_ter: z
    .object({
      alimento_id: z.string(),
      vezes: z.number(),
      contribui: z.array(gunaSchema),
      linha_base: z.string(),
    })
    .optional(),
})

export type EntregaDoModelo = z.infer<typeof entregaDoModeloSchema>

export type Aviso = { tipo: "incomodo" | "geral"; texto: string }

export type SugestaoEntregue = {
  tipo: TipoDeSugestao
  pratica_id?: string
  preparo_id?: string
  titulo: string
  como_fazer: string
  itens: {
    alimento_id: string
    nome: string
    funcao?: Funcao
    contribui: Guna[]
    verbos: string[]
    linha_base: string
    casa: EstadoNaCasa
    observacao?: string
    se_faltar?: { alimento_id: string; nome: string; frase: string }
  }[]
  verbos: string[]
  motivo: string
  linhas_base: string[]
  novidade: boolean
  aviso?: string
}

export type SaidaDoAcompanhante = {
  origem: "agente" | "segura" | "sem_modelo" | "codigo"
  resposta: string
  geral: boolean
  avisos: Aviso[]
  explicacao: { qualidades_do_momento: Guna[]; qualidades_buscadas: Guna[] }
  sugestoes: SugestaoEntregue[]
  evitar: { texto: string; linha_base: string }[]
  incertos: string[]
  citados: string[]
  para_ter?: ParaTer & { verbos: string[]; motivo: string }
  anotacoes: Anotacao[]
}

const itemEntregueSchema = z.object({
  alimento_id: z.string(),
  nome: z.string(),
  funcao: funcaoSchema.optional(),
  contribui: z.array(gunaSchema),
  verbos: z.array(z.string()),
  linha_base: z.string(),
  casa: z.enum(["confirmado", "incerto", "ausente"]),
  observacao: z.string().optional(),
  se_faltar: z.object({ alimento_id: z.string(), nome: z.string(), frase: z.string() }).optional(),
})

const sugestaoEntregueSchema = z.object({
  tipo: z.enum(["cha", "refeicao", "oleo", "pratica"]),
  pratica_id: z.string().optional(),
  preparo_id: z.string().optional(),
  titulo: z.string(),
  como_fazer: z.string(),
  itens: z.array(itemEntregueSchema),
  verbos: z.array(z.string()),
  motivo: z.string(),
  linhas_base: z.array(z.string()),
  novidade: z.boolean(),
  aviso: z.string().optional(),
})

export const saidaDoAcompanhanteSchema = z.object({
  origem: z.enum(["agente", "segura", "sem_modelo", "codigo"]),
  resposta: z.string(),
  geral: z.boolean(),
  avisos: z.array(z.object({ tipo: z.enum(["incomodo", "geral"]), texto: z.string() })),
  explicacao: z.object({
    qualidades_do_momento: z.array(gunaSchema),
    qualidades_buscadas: z.array(gunaSchema),
  }),
  sugestoes: z.array(sugestaoEntregueSchema),
  evitar: z.array(z.object({ texto: z.string(), linha_base: z.string() })),
  incertos: z.array(z.string()),
  citados: z.array(z.string()),
  para_ter: z
    .object({
      alimento_id: z.string(),
      nome: z.string(),
      vezes: z.number(),
      contribui: z.array(gunaSchema),
      linha_base: z.string(),
      verbos: z.array(z.string()),
      motivo: z.string(),
    })
    .optional(),
  anotacoes: z.array(anotacaoSchema),
})

type ItemEntregue = SugestaoEntregue["itens"][number]
type ItemDaEntrega = EntregaDoModelo["sugestoes"][number]["itens"][number]

function verbosDe(gunas: Guna[], kb: KnowledgeBase): string[] {
  const verbos = gunas.map((g) => kb.verbo(g)).filter((v): v is string => v !== null)
  return [...new Set(verbos)]
}

function casaDoItem(id: string, dados: DadosDoPreparo): EstadoNaCasa {
  if (dados.casa.confirmados.includes(id)) return "confirmado"
  if (dados.casa.incertos.includes(id)) return "incerto"
  return "ausente"
}

function trocaDoItem(
  item: ItemDaEntrega,
  kb: KnowledgeBase,
): Pick<ItemEntregue, "se_faltar"> | undefined {
  const de = kb.alimento(item.alimento_id)
  const para = item.se_faltar ? kb.alimento(item.se_faltar) : undefined
  if (!de || !para) return undefined
  const emComum = GUNAS.filter((g) => de.gunas.includes(g) && para.gunas.includes(g))
  return {
    se_faltar: {
      alimento_id: para.id,
      nome: para.nome,
      frase: fraseDaTroca(de, para, emComum, kb),
    },
  }
}

function itemEntregue(item: ItemDaEntrega, dados: DadosDoPreparo, kb: KnowledgeBase): ItemEntregue {
  return {
    alimento_id: item.alimento_id,
    nome: kb.alimento(item.alimento_id)?.nome ?? item.alimento_id,
    ...(item.funcao ? { funcao: item.funcao } : {}),
    contribui: item.contribui,
    verbos: verbosDe(item.contribui, kb),
    linha_base: item.linha_base,
    casa: casaDoItem(item.alimento_id, dados),
    ...trocaDoItem(item, kb),
  }
}

function textosDaSugestao(
  s: EntregaDoModelo["sugestoes"][number],
  kb: KnowledgeBase,
): { titulo: string; como_fazer: string; aviso?: string } {
  const preparo = s.preparo_id ? kb.preparo(s.preparo_id) : undefined
  if (preparo) {
    const itens = s.itens.flatMap((i) =>
      i.funcao ? [{ alimento_id: i.alimento_id, funcao: i.funcao }] : [],
    )
    return {
      titulo: tituloDoPreparo(preparo, itens, kb),
      como_fazer: passosDoPreparo(preparo, itens, kb),
    }
  }
  const pratica = s.pratica_id ? kb.pratica(s.pratica_id) : undefined
  return {
    titulo: pratica?.nome ?? "",
    como_fazer: pratica?.preparo ?? "",
    ...(pratica && pratica.aviso !== "" ? { aviso: pratica.aviso } : {}),
  }
}

function sugestaoEntregue(
  s: EntregaDoModelo["sugestoes"][number],
  dados: DadosDoPreparo,
  kb: KnowledgeBase,
): SugestaoEntregue {
  const itens = s.itens.map((i) => itemEntregue(i, dados, kb))
  return {
    tipo: s.tipo,
    ...(s.pratica_id ? { pratica_id: s.pratica_id } : {}),
    ...(s.preparo_id ? { preparo_id: s.preparo_id } : {}),
    ...textosDaSugestao(s, kb),
    itens,
    verbos: verbosDe(
      s.itens.flatMap((i) => i.contribui),
      kb,
    ),
    motivo: s.motivo,
    linhas_base: s.linhas_base,
    novidade: s.novidade,
  }
}

function avisosDe(dados: DadosDoPreparo): Aviso[] {
  const avisos: Aviso[] = []
  if (dados.com_incomodo)
    avisos.push({ tipo: "incomodo", texto: textosDoAcompanhante.avisoIncomodo })
  if (dados.geral) avisos.push({ tipo: "geral", texto: textosDoAcompanhante.avisoGeral })
  return avisos
}

function paraTerCompleto(
  dados: DadosDoPreparo,
  entrega: EntregaDoModelo,
  kb: KnowledgeBase,
): SaidaDoAcompanhante["para_ter"] {
  const base = dados.para_ter
  if (!entrega.para_ter || !base) return undefined
  return {
    ...base,
    verbos: verbosDe(base.contribui, kb),
    motivo: textosDoAcompanhante.motivoParaTer.replace("{vezes}", String(base.vezes)),
  }
}

export function completarSaida(
  entrega: EntregaDoModelo,
  dados: DadosDoPreparo,
  kb: KnowledgeBase,
): SaidaDoAcompanhante {
  const textos = new Map(dados.qualidades.evitar.map((e) => [e.linha_base, e.texto]))
  const para_ter = paraTerCompleto(dados, entrega, kb)
  return {
    origem: "agente",
    resposta: entrega.resposta,
    geral: dados.geral,
    avisos: avisosDe(dados),
    explicacao: entrega.explicacao,
    sugestoes: entrega.sugestoes.map((s) => sugestaoEntregue(s, dados, kb)),
    evitar: entrega.evitar.map((linha) => ({
      texto: textos.get(linha) ?? linha,
      linha_base: linha,
    })),
    incertos: entrega.incertos,
    citados: entrega.citados,
    ...(para_ter ? { para_ter } : {}),
    anotacoes: [],
  }
}

export function saidaDeCodigo(resposta: string, anotacoes: Anotacao[]): SaidaDoAcompanhante {
  return {
    origem: "codigo",
    resposta,
    geral: false,
    avisos: [],
    explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
    sugestoes: [],
    evitar: [],
    incertos: [],
    citados: [],
    anotacoes,
  }
}

export function saidaSegura(dados?: DadosDoPreparo): SaidaDoAcompanhante {
  return {
    origem: "segura",
    resposta: textosDoAcompanhante.respostaSegura,
    geral: dados?.geral ?? false,
    avisos: [],
    explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
    sugestoes: [],
    evitar: [],
    incertos: [],
    citados: [],
    anotacoes: [],
  }
}

export function saidaSemModelo(
  r: RespostaSemModelo,
  dados: DadosDoPreparo,
  kb: KnowledgeBase,
): SaidaDoAcompanhante {
  return {
    origem: "sem_modelo",
    resposta: r.resposta,
    geral: dados.geral,
    avisos: avisosDe(dados),
    explicacao: {
      qualidades_do_momento: dados.qualidades.presentes,
      qualidades_buscadas: dados.qualidades.buscadas,
    },
    sugestoes: r.praticas.map((p) => {
      const pratica = kb.pratica(p.pratica_id)
      return {
        tipo: "pratica" as const,
        pratica_id: p.pratica_id,
        titulo: p.nome,
        como_fazer: pratica?.preparo ?? "",
        itens: [],
        verbos: p.verbos,
        motivo: "",
        linhas_base: [p.linha_base],
        novidade: false,
        ...(pratica && pratica.aviso !== "" ? { aviso: pratica.aviso } : {}),
      }
    }),
    evitar: [],
    incertos: [],
    citados: [],
    anotacoes: [],
  }
}
