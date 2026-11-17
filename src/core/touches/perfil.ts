import { config } from "@config/index"
import { z } from "zod"
import { cidadeSchema } from "@/core/accounts/cidade"
import { calcularQuiz, nomeDoDosha, prakritiDeclarada } from "@/core/accounts/dosha"
import { quizCompleto } from "@/core/accounts/quiz-completo"
import { RituError } from "@/core/errors"
import type { EvitarItem } from "@/core/knowledge/filtros"
import { identificarAlimento } from "@/core/knowledge/identificar"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { type Dosha, doshaSchema, restricaoSchema } from "@/core/knowledge/vocab"
import type { Stores } from "@/core/stores"
import type { Deps } from "./deps"

const evitarItemSchema = z.strictObject({
  tipo: z.enum(["grupo", "alimento", "texto"]),
  valor: z.string().trim().min(1).max(config.limites.evitar.textoLivreCaracteres),
})

const itemDeNaoComeSchema = z.strictObject({
  tipo: z.enum(["alimento", "texto"]),
  valor: z.string().max(60),
})

export const acaoDoPerfilSchema = z.discriminatedUnion("acao", [
  z.strictObject({ acao: z.literal("dosha"), doshas: z.array(doshaSchema).min(1).max(2) }),
  z.strictObject({
    acao: z.literal("quiz"),
    respostas: z.array(z.strictObject({ pergunta_id: z.string().max(60), dosha: doshaSchema })),
  }),
  z.strictObject({ acao: z.literal("cidade"), cidade: cidadeSchema.nullable() }),
  z.strictObject({
    acao: z.literal("evitar_acrescentar"),
    itens: z.array(evitarItemSchema).min(1).max(config.limites.evitar.maxItens),
  }),
  z.strictObject({
    acao: z.literal("evitar_tirar"),
    item: evitarItemSchema,
    confirmado: z.literal(true),
  }),
  z.strictObject({ acao: z.literal("restricoes"), restricoes: z.array(restricaoSchema).max(4) }),
  z.strictObject({
    acao: z.literal("nao_come_acrescentar"),
    alimento_id: z.string().min(1).max(60).optional(),
    texto: z.string().trim().min(2).max(40).optional(),
  }),
  z.strictObject({ acao: z.literal("nao_come_tirar"), item: itemDeNaoComeSchema }),
])

export type AcaoDoPerfil = z.infer<typeof acaoDoPerfilSchema>

type Item = { tipo: string; valor: string }
type ItemDeNaoCome = { tipo: "alimento" | "texto"; valor: string }
type Resultado = { nome: string }
type Cidade = z.infer<typeof cidadeSchema>

const corpoInvalido = () => new RituError("corpo_invalido", "Corpo inválido")
const toqueInvalido = () => new RituError("toque_invalido", "Toque inválido")

const mesmoItem = (a: Item, b: Item): boolean => a.tipo === b.tipo && a.valor === b.valor

// Nome da base (grupo ou alimento) ou o próprio texto livre. undefined: fora da base.
function nomeDoEvitar(kb: KnowledgeBase, item: EvitarItem): string | undefined {
  if (item.tipo === "grupo") return kb.gruposEvitar.find((g) => g.id === item.valor)?.nome
  if (item.tipo === "alimento") return kb.alimento(item.valor)?.nome
  return item.valor
}

function nomeDoItemDeNaoCome(kb: KnowledgeBase, item: ItemDeNaoCome): string {
  if (item.tipo === "texto") return item.valor
  return kb.alimento(item.valor)?.nome ?? item.valor
}

async function aplicarDosha(
  deps: Deps,
  stores: Stores,
  contaId: string,
  doshas: Dosha[],
): Promise<Resultado> {
  const prakriti = prakritiDeclarada(doshas)
  await stores.profiles.definirPrakriti(contaId, prakriti, "declarado")
  return { nome: nomeDoDosha(prakriti, deps.kb) }
}

async function aplicarQuiz(
  deps: Deps,
  stores: Stores,
  contaId: string,
  respostas: { pergunta_id: string; dosha: Dosha }[],
): Promise<Resultado> {
  const ids = deps.kb.quiz.map((pergunta) => pergunta.id)
  const enviados = respostas.map((r) => r.pergunta_id)
  if (!quizCompleto(ids, enviados)) throw corpoInvalido()
  const resultado = calcularQuiz(respostas.map((r) => r.dosha))
  await stores.profiles.definirPrakriti(contaId, resultado.prakriti, "quiz")
  return { nome: nomeDoDosha(resultado.prakriti, deps.kb) }
}

async function aplicarCidade(
  stores: Stores,
  contaId: string,
  cidade: Cidade | null,
): Promise<Resultado> {
  await stores.profiles.definirCidade(contaId, cidade)
  return { nome: cidade?.nome ?? "" }
}

async function aplicarEvitarAcrescentar(
  deps: Deps,
  stores: Stores,
  contaId: string,
  itens: EvitarItem[],
): Promise<Resultado> {
  const nomes = itens.map((item) => {
    const nome = nomeDoEvitar(deps.kb, item)
    if (nome === undefined) throw toqueInvalido()
    return nome
  })
  await stores.profiles.acrescentarEvitarSempre(contaId, itens)
  return { nome: nomes.join(", ") }
}

async function aplicarEvitarTirar(
  deps: Deps,
  stores: Stores,
  contaId: string,
  item: EvitarItem,
): Promise<Resultado> {
  const perfil = await stores.profiles.ler(contaId)
  if (!perfil.evitar_sempre.some((x) => mesmoItem(x, item))) throw toqueInvalido()
  await stores.profiles.removerEvitarSempre(contaId, item, { confirmado: true })
  return { nome: nomeDoEvitar(deps.kb, item) ?? item.valor }
}

async function aplicarRestricoes(
  stores: Stores,
  contaId: string,
  restricoes: z.infer<typeof restricaoSchema>[],
): Promise<Resultado> {
  await stores.profiles.definirRestricoes(contaId, [...new Set(restricoes)])
  return { nome: "" }
}

// Os dois ou nenhum: corpo inválido. Alimento da base ou texto livre (que a base pode reconhecer).
function itemDoNaoCome(
  deps: Deps,
  alimentoId: string | undefined,
  texto: string | undefined,
): ItemDeNaoCome {
  if (alimentoId !== undefined && texto === undefined) {
    if (!deps.kb.alimento(alimentoId)) throw toqueInvalido()
    return { tipo: "alimento", valor: alimentoId }
  }
  if (texto !== undefined && alimentoId === undefined) {
    const identificado = identificarAlimento(texto, deps.kb)
    if (identificado.tipo === "alimento") return { tipo: "alimento", valor: identificado.id }
    return { tipo: "texto", valor: texto }
  }
  throw corpoInvalido()
}

async function aplicarNaoComeAcrescentar(
  deps: Deps,
  stores: Stores,
  contaId: string,
  alimentoId: string | undefined,
  texto: string | undefined,
): Promise<Resultado> {
  const item = itemDoNaoCome(deps, alimentoId, texto)
  const atual = (await stores.profiles.ler(contaId)).nao_come
  const lista = atual.some((x) => mesmoItem(x, item)) ? atual : [...atual, item]
  await stores.profiles.definirNaoCome(contaId, lista)
  return { nome: nomeDoItemDeNaoCome(deps.kb, item) }
}

async function aplicarNaoComeTirar(
  deps: Deps,
  stores: Stores,
  contaId: string,
  item: ItemDeNaoCome,
): Promise<Resultado> {
  const atual = (await stores.profiles.ler(contaId)).nao_come
  if (!atual.some((x) => mesmoItem(x, item))) throw toqueInvalido()
  await stores.profiles.definirNaoCome(
    contaId,
    atual.filter((x) => !mesmoItem(x, item)),
  )
  return { nome: nomeDoItemDeNaoCome(deps.kb, item) }
}

async function executar(
  deps: Deps,
  stores: Stores,
  contaId: string,
  acao: AcaoDoPerfil,
): Promise<Resultado> {
  switch (acao.acao) {
    case "dosha":
      return aplicarDosha(deps, stores, contaId, acao.doshas)
    case "quiz":
      return aplicarQuiz(deps, stores, contaId, acao.respostas)
    case "cidade":
      return aplicarCidade(stores, contaId, acao.cidade)
    case "evitar_acrescentar":
      return aplicarEvitarAcrescentar(deps, stores, contaId, acao.itens)
    case "evitar_tirar":
      return aplicarEvitarTirar(deps, stores, contaId, acao.item)
    case "restricoes":
      return aplicarRestricoes(stores, contaId, acao.restricoes)
    case "nao_come_acrescentar":
      return aplicarNaoComeAcrescentar(deps, stores, contaId, acao.alimento_id, acao.texto)
    case "nao_come_tirar":
      return aplicarNaoComeTirar(deps, stores, contaId, acao.item)
  }
}

export function tocarPerfil(deps: Deps, contaId: string, acao: AcaoDoPerfil): Promise<Resultado> {
  return deps.telemetry.span("toque", { tipo: "perfil", acao: acao.acao }, async () => {
    const resultado = await deps.tx.emTransacao((stores) => executar(deps, stores, contaId, acao))
    deps.telemetry.contador("ritu_memoria_edicoes_total", { nivel: "fixos", acao: acao.acao })
    return resultado
  })
}
