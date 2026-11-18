import { config } from "@config/index"
import { ESTADOS, type Estado } from "@/core/knowledge/vocab"
import type { TipoPadrao } from "./ports"

export type ItemDoPadrao = { tipo: "pratica" | "preparo"; id: string } | { tipo: "cha" }

const NA_FRASE: Record<Estado, string> = {
  com_frio: "com frio",
  com_calor: "com calor",
  pesada: "pesada",
  seca: "seca",
  agitada: "agitada",
  irritada: "irritada",
  sem_energia: "sem energia",
}

const MODELO_AJUDA = "Quando você está {estados}, {titulo} costuma te ajudar."
export const MODELO_AJUDA_CHA = "Quando você está {estados}, um chá costuma te ajudar."
const MODELO_JUNTOS = "Quando você está {a}, costuma estar também {b}."
const ARTIGO = /^(os|as|uma|um|o|a)\s+/i

function emOrdem(estados: Estado[]): Estado[] {
  return ESTADOS.filter((e) => estados.includes(e))
}

/** Chave do item dentro do padrão: `cha` sozinho, ou `<tipo>:<id>`. */
export function chaveDoItem(item: ItemDoPadrao): string {
  return item.tipo === "cha" ? "cha" : `${item.tipo}:${item.id}`
}

export function chaveDeAjuda(estados: Estado[], item: ItemDoPadrao): string {
  return `${emOrdem(estados).join("+")}|${chaveDoItem(item)}`
}

export function chaveDeJuntos(a: Estado, b: Estado): string {
  return `${a}>${b}`
}

function ehEstado(valor: string): valor is Estado {
  return (ESTADOS as readonly string[]).includes(valor)
}

function estadosValidos(texto: string): Estado[] | undefined {
  const partes = texto.split("+")
  const unicos = new Set(partes)
  const formatoOk =
    partes.every(ehEstado) &&
    unicos.size === partes.length &&
    partes.length <= config.padroes.maxEstadosNaChave
  return formatoOk ? (partes as Estado[]) : undefined
}

function itemValido(texto: string): ItemDoPadrao | undefined {
  if (texto === "cha") return { tipo: "cha" }
  const i = texto.indexOf(":")
  if (i < 0) return undefined
  const tipo = texto.slice(0, i)
  const id = texto.slice(i + 1)
  if (tipo !== "pratica" && tipo !== "preparo") return undefined
  if (id === "") return undefined
  return { tipo, id }
}

function lerAjuda(chave: string): { estados: Estado[]; item?: ItemDoPadrao } | undefined {
  const partes = chave.split("|")
  if (partes.length !== 2) return undefined
  const estados = estadosValidos(partes[0] ?? "")
  const item = itemValido(partes[1] ?? "")
  if (!estados || !item) return undefined
  return { estados, item }
}

function lerJuntos(chave: string): { estados: Estado[] } | undefined {
  const partes = chave.split(">")
  if (partes.length !== 2) return undefined
  const [a, b] = partes
  if (!a || !b || a === b || !ehEstado(a) || !ehEstado(b)) return undefined
  return { estados: [a, b] }
}

export function lerChave(
  tipo: TipoPadrao,
  chave: string,
): { estados: Estado[]; item?: ItemDoPadrao } | undefined {
  if (tipo === "ajuda_em_estado") return lerAjuda(chave)
  return lerJuntos(chave)
}

function textoDosEstados(estados: Estado[]): string {
  const nomes = emOrdem(estados).map((e) => NA_FRASE[e])
  if (nomes.length <= 1) return nomes.join("")
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`
}

function semArtigo(titulo: string): string {
  const semEle = titulo.trim().replace(ARTIGO, "")
  return semEle.charAt(0).toLowerCase() + semEle.slice(1)
}

export function fraseDeAjuda(estados: Estado[], titulo: string): string {
  return MODELO_AJUDA.replace("{estados}", () => textoDosEstados(estados)).replace("{titulo}", () =>
    semArtigo(titulo),
  )
}

export function fraseDeAjudaCha(estados: Estado[]): string {
  return MODELO_AJUDA_CHA.replace("{estados}", () => textoDosEstados(estados))
}

export function fraseDeJuntos(a: Estado, b: Estado): string {
  return MODELO_JUNTOS.replace("{a}", () => NA_FRASE[a]).replace("{b}", () => NA_FRASE[b])
}
