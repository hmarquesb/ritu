import type { EvitarItem } from "./filtros"
import type { KnowledgeBase } from "./knowledge-base"
import type { Alimento } from "./schemas"

export type Identificacao =
  | { tipo: "alimento"; id: string }
  | { tipo: "desconhecido"; nome: string }

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function nomesDoAlimento(alimento: Alimento): string[] {
  return [alimento.id.replace(/-/g, " "), alimento.nome, ...alimento.sinonimos].map(normalizar)
}

export function identificarAlimento(nome: string, kb: KnowledgeBase): Identificacao {
  const alvo = normalizar(nome)
  const achado = kb.alimentos.find((alimento) => nomesDoAlimento(alimento).includes(alvo))
  return achado ? { tipo: "alimento", id: achado.id } : { tipo: "desconhecido", nome }
}

// Palavra inteira: "queijo" casa com "queijo branco", mas "ovo" não casa com "novo".
function contemPalavra(texto: string, palavra: string): boolean {
  return ` ${texto} `.includes(` ${palavra} `)
}

function grupoDoTexto(texto: string, kb: KnowledgeBase): string | undefined {
  const n = normalizar(texto)
  return kb.gruposEvitar.find((grupo) =>
    grupo.palavras
      .map(normalizar)
      .filter((palavra) => palavra !== "")
      .some((palavra) => contemPalavra(n, palavra)),
  )?.id
}

export function resolverEvitar(texto: string, kb: KnowledgeBase): EvitarItem {
  const alimento = identificarAlimento(texto, kb)
  if (alimento.tipo === "alimento") return { tipo: "alimento", valor: alimento.id }

  const grupo = grupoDoTexto(texto, kb)
  if (grupo) return { tipo: "grupo", valor: grupo }

  return { tipo: "texto", valor: texto }
}
