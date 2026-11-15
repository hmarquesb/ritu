import { z } from "zod"
import {
  confiancaSchema,
  DOSHAS,
  doshaSchema,
  durabilidadeSchema,
  estadoSchema,
  funcaoSchema,
  type Guna,
  grupoEvitarSchema,
  grupoSchema,
  gunaSchema,
  marcaSchema,
  momentoDoDiaSchema,
  OPOSTO,
  rasaSchema,
  restricaoSchema,
  temaQuizSchema,
  tipoPraticaSchema,
  vipakaSchema,
  viryaSchema,
} from "./vocab"

export const idSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "id em kebab-case")

const efeitoInteiro = z.number().int().min(-2).max(2)

export const efeitoSchema = z.strictObject({
  vata: efeitoInteiro,
  pitta: efeitoInteiro,
  kapha: efeitoInteiro,
})

export const fonteRefSchema = z.strictObject({
  ref: z.string().min(1),
  campos: z.array(z.string().min(1)),
})

const fontesSchema = z.array(fonteRefSchema).min(1)

function gunasSemRepeticao(gunas: Guna[]): boolean {
  return new Set(gunas).size === gunas.length
}

function gunasSemPar(gunas: Guna[]): boolean {
  return gunas.every((guna) => !gunas.includes(OPOSTO[guna]))
}

const gunasSchema = z
  .array(gunaSchema)
  .min(1)
  .max(4)
  .refine(gunasSemRepeticao, "gunas não podem se repetir")
  .refine(gunasSemPar, "gunas não podem ter os dois lados de um mesmo par (ex.: quente e frio)")

export const alimentoSchema = z.strictObject({
  id: idSchema,
  nome: z.string().min(1),
  sinonimos: z.array(z.string().min(1)),
  grupo: grupoSchema,
  durabilidade: durabilidadeSchema,
  funcoes: z.array(funcaoSchema).min(1),
  rasa: z.array(rasaSchema).min(1),
  virya: viryaSchema,
  vipaka: vipakaSchema,
  gunas: gunasSchema,
  efeito: efeitoSchema,
  como_equilibrar: z.partialRecord(doshaSchema, z.string().max(120)),
  restricoes: z.array(restricaoSchema),
  grupos_evitar: z.array(grupoEvitarSchema),
  marcas: z.array(marcaSchema),
  observacao: z.string().max(120).optional(),
  fontes: fontesSchema,
  confianca: confiancaSchema,
  notas: z.string(),
})
export type Alimento = z.infer<typeof alimentoSchema>

export const vagaSchema = z
  .strictObject({
    funcao: funcaoSchema,
    obrigatoria: z.boolean(),
    maximo: z.number().int().min(1).default(1),
    grupos: z.array(grupoSchema).optional(),
    alimentos: z.array(idSchema).min(1).optional(),
  })
  .refine((vaga) => !(vaga.alimentos && vaga.grupos), "alimentos e grupos não vêm juntos")
export type Vaga = z.infer<typeof vagaSchema>

function algumaVagaObrigatoria(vagas: Vaga[]): boolean {
  return vagas.some((vaga) => vaga.obrigatoria)
}

export const preparoSchema = z.strictObject({
  id: idSchema,
  nome: z.string().min(1),
  titulo: z.string().min(1).max(60),
  vagas: z
    .array(vagaSchema)
    .min(1)
    .refine(algumaVagaObrigatoria, "o preparo precisa de pelo menos uma vaga obrigatória"),
  gunas_do_preparo: z.array(gunaSchema),
  passos: z.string().max(400),
  momento: z.array(momentoDoDiaSchema).min(1),
  contraindicacoes: z.array(estadoSchema),
  fontes: fontesSchema,
  confianca: confiancaSchema,
})
export type Preparo = z.infer<typeof preparoSchema>

function ingredientesConformeTipo(pratica: { tipo: string; ingredientes: string[] }): boolean {
  return pratica.tipo === "pratica" || pratica.ingredientes.length > 0
}

export const praticaSchema = z
  .strictObject({
    id: idSchema,
    tipo: tipoPraticaSchema,
    nome: z.string().min(1),
    ingredientes: z.array(idSchema),
    preparo: z.string().max(300),
    gunas: z.array(gunaSchema),
    favorece_estados: z.array(estadoSchema).min(1),
    efeito: efeitoSchema,
    momento: z.array(momentoDoDiaSchema),
    contraindicacoes: z.array(estadoSchema),
    nunca_sugerir_se: z.array(restricaoSchema),
    aviso: z.string(),
    fontes: fontesSchema,
    confianca: confiancaSchema,
  })
  .refine(ingredientesConformeTipo, "só a prática do tipo pratica pode ter ingredientes vazios")
export type Pratica = z.infer<typeof praticaSchema>

export const combinacaoSchema = z.strictObject({
  id: idSchema,
  itens: z.array(z.string().regex(/^(alimento|grupo|marca):/)).min(2),
  motivo: z.string(),
  fontes: fontesSchema,
  confianca: confiancaSchema,
})
export type Combinacao = z.infer<typeof combinacaoSchema>

export const doshaInfoSchema = z.strictObject({
  id: doshaSchema,
  nome: z.string().min(1),
  elementos: z.array(z.string()),
  resumo: z.string(),
  gunas: z.array(gunaSchema),
  equilibra_gunas: z.array(gunaSchema),
  equilibra_rasas: z.array(rasaSchema),
  caracteristicas: z.strictObject({
    corpo: z.string(),
    mente: z.string(),
    digestao: z.string(),
  }),
  desequilibra: z.string(),
  equilibra: z.string(),
  fontes: fontesSchema,
})
export type DoshaInfo = z.infer<typeof doshaInfoSchema>

export const estadoInfoSchema = z.strictObject({
  id: estadoSchema,
  rotulo: z.string().min(1),
  emoji: z.string(),
  eixo: z.enum(["temperatura", "corpo", "mente"]),
  presentes: z.array(gunaSchema),
  favorecer: z.array(gunaSchema),
  evitar_gunas: z.array(gunaSchema),
  evitar_marcas: z.array(marcaSchema),
  evitar_texto: z.string(),
  fontes: fontesSchema,
  confianca: confiancaSchema,
})
export type EstadoInfo = z.infer<typeof estadoInfoSchema>

const varianteSchema = z.strictObject({
  id: idSchema,
  opcao: z.string().min(1),
  presentes: z.array(gunaSchema),
  favorecer: z.array(gunaSchema),
  evitar_gunas: z.array(gunaSchema),
  evitar_marcas: z.array(marcaSchema),
  evitar_texto: z.string(),
})

type Variante = z.infer<typeof varianteSchema>

function exigePerguntaSeVariasVariantes(
  incomodo: { pergunta?: string; variantes: Variante[] },
  ctx: z.RefinementCtx,
): void {
  if (incomodo.variantes.length > 1 && !incomodo.pergunta) {
    ctx.addIssue({ code: "custom", message: "com mais de uma variante, a pergunta é obrigatória" })
  }
}

function exigeIdUnicaSeVarianteUnica(
  incomodo: { variantes: Variante[] },
  ctx: z.RefinementCtx,
): void {
  const [unica] = incomodo.variantes
  if (incomodo.variantes.length === 1 && unica?.id !== "unica") {
    ctx.addIssue({ code: "custom", message: 'com uma só variante, o id é "unica"' })
  }
}

export const incomodoSchema = z
  .strictObject({
    id: idSchema,
    nome: z.string().min(1),
    palavras: z.array(z.string().min(1)),
    pergunta: z.string().optional(),
    variantes: z.array(varianteSchema).min(1),
    fontes: fontesSchema,
    confianca: confiancaSchema,
  })
  .superRefine(exigePerguntaSeVariasVariantes)
  .superRefine(exigeIdUnicaSeVarianteUnica)
export type Incomodo = z.infer<typeof incomodoSchema>

function umaOpcaoPorDosha(opcoes: { dosha: string }[]): boolean {
  return new Set(opcoes.map((opcao) => opcao.dosha)).size === DOSHAS.length
}

export const perguntaQuizSchema = z.strictObject({
  id: idSchema,
  tema: temaQuizSchema,
  texto: z.string().min(1),
  opcoes: z
    .array(z.strictObject({ dosha: doshaSchema, texto: z.string().min(1) }))
    .length(DOSHAS.length)
    .refine(umaOpcaoPorDosha, "cada dosha precisa aparecer em exatamente uma opção"),
  fontes: fontesSchema,
})
export type PerguntaQuiz = z.infer<typeof perguntaQuizSchema>

export const grupoEvitarInfoSchema = z.strictObject({
  id: grupoEvitarSchema,
  nome: z.string().min(1),
  palavras: z.array(z.string().min(1)),
})
export type GrupoEvitarInfo = z.infer<typeof grupoEvitarInfoSchema>

export const vocabuloGunaSchema = z.strictObject({
  guna: gunaSchema,
  nome: z.string().min(1),
  verbo: z.string().nullable(),
})
export type VocabuloGuna = z.infer<typeof vocabuloGunaSchema>

export const fonteSchema = z.strictObject({
  ref: idSchema,
  titulo: z.string().min(1),
  autor: z.string().min(1),
  edicao: z.string().optional(),
  pagina: z.string().optional(),
  url: z.string().optional(),
  acessado_em: z.string().optional(),
  aprovada: z.boolean(),
})
export type Fonte = z.infer<typeof fonteSchema>

export const dadosDaBaseSchema = z.strictObject({
  alimentos: z.array(alimentoSchema),
  preparos: z.array(preparoSchema),
  praticas: z.array(praticaSchema),
  combinacoes: z.array(combinacaoSchema),
  doshas: z.array(doshaInfoSchema),
  estados: z.array(estadoInfoSchema),
  incomodos: z.array(incomodoSchema),
  quiz: z.array(perguntaQuizSchema),
  gruposEvitar: z.array(grupoEvitarInfoSchema),
  vocabulario: z.array(vocabuloGunaSchema),
  fontes: z.array(fonteSchema),
})
export type DadosDaBase = z.infer<typeof dadosDaBaseSchema>

export type FonteRef = z.infer<typeof fonteRefSchema>
