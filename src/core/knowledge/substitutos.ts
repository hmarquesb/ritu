import { checarCombinacao } from "./combinacoes"
import { candidatosDaVaga, type FiltroPessoa, passaNoFiltro } from "./filtros"
import type { KnowledgeBase } from "./knowledge-base"
import type { Alimento, Vaga } from "./schemas"
import { type Funcao, GUNAS, type Guna } from "./vocab"

export type SinaisPessoa = { em_casa: string[]; gosta: string[]; ajudou: Record<string, number> }
export type Substituto = {
  alimento_id: string
  nome: string
  em_comum: Guna[]
  em_casa: boolean
  motivo: string
  linha_base: string
}

export const sinaisVazios: Readonly<SinaisPessoa> = Object.freeze({
  em_casa: Object.freeze([] as string[]) as string[],
  gosta: Object.freeze([] as string[]) as string[],
  ajudou: Object.freeze({}) as Record<string, number>,
})

type ParametrosSubstitutos = {
  alimento_id: string
  funcao?: Funcao
  preparo_id?: string
  outros_itens: string[]
  filtro: FiltroPessoa
  sinais: SinaisPessoa
  limite: number
}

type Candidato = { alimento: Alimento; emComum: Guna[] }

function gunasEmComum(a: Alimento, b: Alimento): Guna[] {
  return GUNAS.filter((g) => a.gunas.includes(g) && b.gunas.includes(g))
}

function vagaDoPreparo(preparoId: string, funcao: Funcao, kb: KnowledgeBase): Vaga | undefined {
  return kb.preparo(preparoId)?.vagas.find((v) => v.funcao === funcao)
}

// Sem função: mesmo grupo do alimento. Com função: a função; com preparo, a vaga dela no preparo.
function candidatosDaTroca(
  base: Alimento,
  p: ParametrosSubstitutos,
  kb: KnowledgeBase,
): Alimento[] {
  if (p.funcao === undefined) return kb.alimentos.filter((a) => a.grupo === base.grupo)
  if (p.preparo_id === undefined) return candidatosDaVaga({ funcao: p.funcao }, kb)
  const vaga = vagaDoPreparo(p.preparo_id, p.funcao, kb)
  return vaga ? candidatosDaVaga(vaga, kb) : []
}

function elegivel(
  base: Alimento,
  c: Alimento,
  p: ParametrosSubstitutos,
  kb: KnowledgeBase,
): boolean {
  return (
    c.id !== base.id &&
    c.virya === base.virya &&
    passaNoFiltro(c, p.filtro, kb).passa &&
    checarCombinacao([...p.outros_itens, c.id], kb).compativel
  )
}

function candidatosComEmComum(
  base: Alimento,
  p: ParametrosSubstitutos,
  kb: KnowledgeBase,
): Candidato[] {
  return candidatosDaTroca(base, p, kb)
    .map((alimento) => ({ alimento, emComum: gunasEmComum(base, alimento) }))
    .filter((c) => c.emComum.length > 0 && elegivel(base, c.alimento, p, kb))
}

const sim = (verdadeiro: boolean): number => (verdadeiro ? 1 : 0)

// Ordem: mais gunas em comum → está em casa → a pessoa gosta → mais vezes ajudou → nome.
function comparar(sinais: SinaisPessoa): (a: Candidato, b: Candidato) => number {
  return (a, b) =>
    b.emComum.length - a.emComum.length ||
    sim(sinais.em_casa.includes(b.alimento.id)) - sim(sinais.em_casa.includes(a.alimento.id)) ||
    sim(sinais.gosta.includes(b.alimento.id)) - sim(sinais.gosta.includes(a.alimento.id)) ||
    (sinais.ajudou[b.alimento.id] ?? 0) - (sinais.ajudou[a.alimento.id] ?? 0) ||
    a.alimento.nome.localeCompare(b.alimento.nome, "pt-BR")
}

const minusculas = (texto: string): string => texto.toLocaleLowerCase("pt-BR")

// "aquece" → "aquecem"; "alivia o peso" → "aliviam o peso": pluraliza só a primeira palavra.
function pluralizarVerbo(verbo: string): string {
  const [primeira = "", ...resto] = verbo.split(" ")
  const plural = /[aeiou]$/.test(primeira) ? `${primeira}m` : primeira
  return [plural, ...resto].join(" ")
}

// Até dois verbos, na ordem de GUNAS, só das gunas em comum que têm verbo.
function verbosDoPar(emComum: Guna[], kb: KnowledgeBase): string[] {
  return GUNAS.filter((g) => emComum.includes(g))
    .map((g) => kb.verbo(g))
    .filter((v): v is string => v !== null)
    .slice(0, 2)
}

export function fraseDaTroca(
  de: Alimento,
  para: Alimento,
  emComum: Guna[],
  kb: KnowledgeBase,
): string {
  const troca = `Troquei ${minusculas(de.nome)} por ${minusculas(para.nome)}`
  const verbos = verbosDoPar(emComum, kb).map(pluralizarVerbo)
  if (verbos.length === 0) return `${troca}: têm a mesma função no preparo.`
  return `${troca}: os dois ${verbos.join(" e ")}.`
}

export function substitutos(p: ParametrosSubstitutos, kb: KnowledgeBase): Substituto[] {
  const base = kb.alimento(p.alimento_id)
  if (!base) return []
  return candidatosComEmComum(base, p, kb)
    .sort(comparar(p.sinais))
    .slice(0, p.limite)
    .map((c) => ({
      alimento_id: c.alimento.id,
      nome: c.alimento.nome,
      em_comum: c.emComum,
      em_casa: p.sinais.em_casa.includes(c.alimento.id),
      motivo: fraseDaTroca(base, c.alimento, c.emComum, kb),
      linha_base: `alimentos:${c.alimento.id}`,
    }))
}
