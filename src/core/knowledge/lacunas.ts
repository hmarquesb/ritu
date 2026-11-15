import type { KnowledgeBase } from "./knowledge-base"
import type { Preparo } from "./schemas"
import type { Funcao } from "./vocab"

type Nomes = Partial<Record<Funcao, string[]>>
type ItemDoPreparo = { alimento_id: string; funcao: Funcao }

const LACUNA = /\{(\w+)\}/g
const LACUNA_UMA = /\{\w+\}/
const CONECTOR_DEPOIS = /^(?: e |, )/
const CONECTOR_ANTES = /(?: e |, )$/
const PALAVRA_ANTES = /\S+\s*$/

function lista(nomes: string[]): string {
  const minusculos = nomes.map((nome) => nome.toLowerCase())
  const ultimo = minusculos.pop() ?? ""
  return minusculos.length === 0 ? ultimo : `${minusculos.join(", ")} e ${ultimo}`
}

function preencherComNomes(frase: string, nomes: Nomes): string {
  return frase.replace(LACUNA, (todo, funcao: Funcao) => {
    const preenchidos = nomes[funcao]
    return preenchidos && preenchidos.length > 0 ? lista(preenchidos) : todo
  })
}

// Tira a primeira lacuna vazia junto com o conector que vem depois, ou antes, ou a palavra anterior.
function tirarLacunasVazias(frase: string): string {
  const achada = LACUNA_UMA.exec(frase)
  if (!achada) return frase
  const inicio = achada.index
  const fim = inicio + achada[0].length
  const antes = frase.slice(0, inicio)
  const depois = frase.slice(fim)
  const conectorDepois = CONECTOR_DEPOIS.exec(depois)
  if (conectorDepois) return tirarLacunasVazias(antes + depois.slice(conectorDepois[0].length))
  const conectorAntes = CONECTOR_ANTES.exec(antes)
  if (conectorAntes) {
    return tirarLacunasVazias(antes.slice(0, -conectorAntes[0].length) + depois)
  }
  return tirarLacunasVazias(antes.replace(PALAVRA_ANTES, "") + depois)
}

function preencherFrase(frase: string, nomes: Nomes): string {
  const funcoes = [...frase.matchAll(LACUNA)].map((achada) => achada[1] as Funcao)
  if (funcoes.length === 0) return frase
  if (funcoes.every((funcao) => !nomes[funcao]?.length)) return ""
  return tirarLacunasVazias(preencherComNomes(frase, nomes))
}

export function preencherLacunas(modelo: string, nomes: Partial<Record<Funcao, string[]>>): string {
  const frases = modelo
    .split(/(?<=\.)/)
    .map((frase) => preencherFrase(frase, nomes))
    .join("")
  const limpo = frases.replace(/ {2,}/g, " ").trim()
  return limpo.charAt(0).toUpperCase() + limpo.slice(1)
}

function nomesPorFuncao(itens: ItemDoPreparo[], kb: KnowledgeBase): Nomes {
  const nomes: Nomes = {}
  for (const item of itens) {
    const nome = kb.alimento(item.alimento_id)?.nome
    if (!nome) continue
    nomes[item.funcao] = [...(nomes[item.funcao] ?? []), nome]
  }
  return nomes
}

export function tituloDoPreparo(p: Preparo, itens: ItemDoPreparo[], kb: KnowledgeBase): string {
  return preencherLacunas(p.titulo, nomesPorFuncao(itens, kb))
}

export function passosDoPreparo(p: Preparo, itens: ItemDoPreparo[], kb: KnowledgeBase): string {
  return preencherLacunas(p.passos, nomesPorFuncao(itens, kb))
}
