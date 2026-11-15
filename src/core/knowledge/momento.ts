import { config } from "@config/index"
import type { KnowledgeBase } from "./knowledge-base"
import type { Incomodo } from "./schemas"
import {
  type Estado,
  type Guna,
  type Marca,
  MOMENTOS_DO_DIA,
  type MomentoDoDia,
  OPOSTO,
} from "./vocab"

export type MomentoEntrada = {
  estados: Estado[]
  incomodo?: { id: string; variante?: string }
  gunasDoClima?: Guna[]
}

export type MomentoQualidades = {
  presentes: Guna[]
  buscadas: Guna[]
  evitar_gunas: Guna[]
  evitar_marcas: Marca[]
  evitar: { texto: string; linha_base: string }[]
  conflitos: [Guna, Guna][]
  linhas_base: string[]
  precisa_variante?: { incomodo: string; pergunta: string; opcoes: { id: string; texto: string }[] }
}

// Campos de qualidades comuns a um estado e a uma variante de incômodo.
type Linha = {
  presentes: Guna[]
  favorecer: Guna[]
  evitar_gunas: Guna[]
  evitar_marcas: Marca[]
  evitar_texto: string
}

type Parte = { linha: Linha; linhaBase: string }

type Resolucao = { parte?: Parte; precisa?: NonNullable<MomentoQualidades["precisa_variante"]> }

function uniao<T>(listas: T[][]): T[] {
  return [...new Set(listas.flat())]
}

function partesDosEstados(estados: Estado[], kb: KnowledgeBase): Parte[] {
  return estados.flatMap((id): Parte[] => {
    const linha = kb.estados.find((e) => e.id === id)
    return linha ? [{ linha, linhaBase: `estados:${id}` }] : []
  })
}

// Com uma só variante, ela vale sem perguntar. Com mais de uma, vale a informada; se não houver, pergunta.
function escolherVariante(incomodo: Incomodo, id?: string) {
  if (incomodo.variantes.length === 1) return incomodo.variantes[0]
  return incomodo.variantes.find((v) => v.id === id)
}

function resolverIncomodo(
  entrada: { id: string; variante?: string },
  kb: KnowledgeBase,
): Resolucao {
  const incomodo = kb.incomodos.find((i) => i.id === entrada.id)
  if (!incomodo) return {}
  const variante = escolherVariante(incomodo, entrada.variante)
  if (variante) {
    return {
      parte: { linha: variante, linhaBase: `incomodos:${incomodo.id}/${variante.id}` },
    }
  }
  return {
    precisa: {
      incomodo: incomodo.id,
      pergunta: incomodo.pergunta ?? incomodo.nome,
      opcoes: incomodo.variantes.map((v) => ({ id: v.id, texto: v.opcao })),
    },
  }
}

// Pares de qualidades opostas, ambas pedidas. Cada par sai uma vez, na ordem em que apareceu.
function paresEmConflito(buscadas: Guna[]): [Guna, Guna][] {
  return buscadas.flatMap((a, i): [Guna, Guna][] => {
    const b = OPOSTO[a]
    return buscadas.indexOf(b) > i ? [[a, b]] : []
  })
}

function evitarDasPartes(partes: Parte[]): MomentoQualidades["evitar"] {
  return partes
    .filter((p) => p.linha.evitar_texto.length > 0)
    .map((p) => ({ texto: p.linha.evitar_texto, linha_base: p.linhaBase }))
}

export function qualidadesDoMomento(entrada: MomentoEntrada, kb: KnowledgeBase): MomentoQualidades {
  const partes = partesDosEstados(entrada.estados, kb)
  const incomodo = entrada.incomodo ? resolverIncomodo(entrada.incomodo, kb) : {}
  if (incomodo.parte) partes.push(incomodo.parte)

  const doClima = entrada.gunasDoClima ?? []
  const buscadas = uniao([...partes.map((p) => p.linha.favorecer), doClima.map((g) => OPOSTO[g])])

  return {
    presentes: uniao([...partes.map((p) => p.linha.presentes), doClima]),
    buscadas,
    evitar_gunas: uniao(partes.map((p) => p.linha.evitar_gunas)),
    evitar_marcas: uniao(partes.map((p) => p.linha.evitar_marcas)),
    evitar: evitarDasPartes(partes),
    conflitos: paresEmConflito(buscadas),
    linhas_base: partes.map((p) => p.linhaBase),
    ...(incomodo.precisa ? { precisa_variante: incomodo.precisa } : {}),
  }
}

function dentroDaFaixa(hora: number, faixa: { inicio: number; fim: number }): boolean {
  // A faixa que atravessa a meia-noite (inicio > fim) cobre o fim do dia e o começo do seguinte.
  return faixa.inicio <= faixa.fim
    ? hora >= faixa.inicio && hora <= faixa.fim
    : hora >= faixa.inicio || hora <= faixa.fim
}

export function momentoDoDia(hora: number): MomentoDoDia {
  const achado = MOMENTOS_DO_DIA.find((m) => dentroDaFaixa(hora, config.momentoDoDia[m]))
  // As faixas cobrem as 24 horas; o fallback só existe para o compilador.
  return achado ?? "noite"
}
