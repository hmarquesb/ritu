import { RituError } from "@/core/errors"
import { derivarChas } from "./chas"
import type {
  Alimento,
  Combinacao,
  DadosDaBase,
  DoshaInfo,
  EstadoInfo,
  Fonte,
  GrupoEvitarInfo,
  Incomodo,
  PerguntaQuiz,
  Pratica,
  Preparo,
  VocabuloGuna,
} from "./schemas"
import { analisarBase, type OpcoesValidacao } from "./validate"
import type { Guna } from "./vocab"

export { type Contagens, validarBase } from "./validate"

export interface KnowledgeBase {
  readonly alimentos: readonly Alimento[]
  readonly preparos: readonly Preparo[]
  readonly praticas: readonly Pratica[]
  readonly combinacoes: readonly Combinacao[]
  readonly doshas: readonly DoshaInfo[]
  readonly estados: readonly EstadoInfo[]
  readonly incomodos: readonly Incomodo[]
  readonly quiz: readonly PerguntaQuiz[]
  readonly gruposEvitar: readonly GrupoEvitarInfo[]
  readonly vocabulario: readonly VocabuloGuna[]
  readonly fontes: readonly Fonte[]
  alimento(id: string): Alimento | undefined
  preparo(id: string): Preparo | undefined
  pratica(id: string): Pratica | undefined
  linha(ref: string): unknown
  verbo(guna: Guna): string | null
}

export class KnowledgeInvalidError extends RituError {
  readonly erros: string[]

  constructor(erros: string[]) {
    super(
      "base_invalida",
      `Base de conhecimento inválida: ${erros.length} erro(s). Primeiros: ${erros.slice(0, 3).join("; ")}`,
    )
    this.name = "KnowledgeInvalidError"
    this.erros = erros
  }
}

function indexar<T extends { id: string }>(itens: readonly T[]): Map<string, T> {
  return new Map(itens.map((item) => [item.id, item] as const))
}

function indexarPrincipais(
  d: DadosDaBase,
  adicionar: (tabela: string, id: string, valor: unknown) => void,
) {
  for (const a of d.alimentos) adicionar("alimentos", a.id, a)
  for (const p of d.preparos) adicionar("preparos", p.id, p)
  for (const p of d.praticas) adicionar("praticas", p.id, p)
  for (const c of d.combinacoes) adicionar("combinacoes", c.id, c)
  for (const x of d.doshas) adicionar("doshas", x.id, x)
  for (const e of d.estados) adicionar("estados", e.id, e)
}

function indexarDemais(
  d: DadosDaBase,
  adicionar: (tabela: string, id: string, valor: unknown) => void,
) {
  for (const i of d.incomodos) {
    adicionar("incomodos", i.id, i)
    for (const v of i.variantes) adicionar("incomodos", `${i.id}/${v.id}`, v)
  }
  for (const q of d.quiz) adicionar("quiz", q.id, q)
  for (const g of d.gruposEvitar) adicionar("grupos_evitar", g.id, g)
  for (const v of d.vocabulario) adicionar("vocabulario", v.guna, v)
  for (const f of d.fontes) adicionar("fontes", f.ref, f)
}

// Chaves no formato "<tabela>:<id>"; incômodo também como "incomodos:<id>/<variante>".
function indexarLinhas(d: DadosDaBase): Map<string, unknown> {
  const linhas = new Map<string, unknown>()
  const adicionar = (tabela: string, id: string, valor: unknown) => {
    linhas.set(`${tabela}:${id}`, valor)
  }
  indexarPrincipais(d, adicionar)
  indexarDemais(d, adicionar)
  return linhas
}

function montar(base: DadosDaBase): KnowledgeBase {
  // Os chás derivados entram depois das práticas fixas.
  const d: DadosDaBase = {
    ...base,
    praticas: [...base.praticas, ...derivarChas(base.alimentos, base.estados)],
  }
  const alimentos = indexar(d.alimentos)
  const preparos = indexar(d.preparos)
  const praticas = indexar(d.praticas)
  const linhas = indexarLinhas(d)
  const verbos = new Map(d.vocabulario.map((v) => [v.guna, v.verbo] as const))
  return {
    alimentos: d.alimentos,
    preparos: d.preparos,
    praticas: d.praticas,
    combinacoes: d.combinacoes,
    doshas: d.doshas,
    estados: d.estados,
    incomodos: d.incomodos,
    quiz: d.quiz,
    gruposEvitar: d.gruposEvitar,
    vocabulario: d.vocabulario,
    fontes: d.fontes,
    alimento: (id) => alimentos.get(id),
    preparo: (id) => preparos.get(id),
    pratica: (id) => praticas.get(id),
    linha: (ref) => linhas.get(ref),
    verbo: (guna) => verbos.get(guna) ?? null,
  }
}

export function createKnowledgeBase(
  dados: DadosDaBase,
  opcoes: OpcoesValidacao = {},
): KnowledgeBase {
  const analise = analisarBase(dados, opcoes)
  if (analise.erros.length > 0) throw new KnowledgeInvalidError(analise.erros)
  return montar(analise.dados)
}
