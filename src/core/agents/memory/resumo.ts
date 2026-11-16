import { config } from "@config/index"
import { contemIncomodo } from "@/core/knowledge/incomodo-no-texto"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { type NotaParaResumo, ordenarNotas } from "./entrada"

const TETO = config.memoria.resumoRotinaCaracteres

function frase(texto: string): string {
  const limpo = texto.trim()
  const maiuscula = limpo.charAt(0).toUpperCase() + limpo.slice(1)
  return maiuscula.endsWith(".") ? maiuscula : `${maiuscula}.`
}

// Sem modelo: as notas mais recentes primeiro, até o teto (para na primeira que não cabe).
export function resumoPorCodigo(notas: NotaParaResumo[]): string {
  let resumo = ""
  for (const nota of ordenarNotas(notas).reverse()) {
    const candidato = resumo === "" ? frase(nota.texto) : `${resumo} ${frase(nota.texto)}`
    if (candidato.length > TETO) break
    resumo = candidato
  }
  return resumo
}

// Apara, junta espaços e confere tamanho e incômodo. Devolve undefined quando não serve.
export function validarResumo(texto: string, kb: KnowledgeBase): string | undefined {
  const normalizado = texto.replace(/\s+/g, " ").trim()
  if (normalizado === "" || normalizado.length > TETO) return undefined
  if (contemIncomodo(normalizado, kb)) return undefined
  return normalizado
}
