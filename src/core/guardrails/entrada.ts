import { ALERTA_EMOCIONAL, ALERTA_FISICO, INJECTION, TAGS } from "./padroes"

export type ResultadoDaEntrada =
  | { resultado: "ok" }
  | { resultado: "alerta"; tipo: "emocional" | "fisico" }
  | { resultado: "injection" }

// Normalização própria do guardrail: a pontuação fica, porque os padrões de
// alerta dependem dela (ex.: "não aguento mais." contra "não aguento mais, ...").
function normalizarParaPadroes(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim()
}

const casa = (padroes: RegExp[], texto: string): boolean => padroes.some((p) => p.test(texto))

export function conferirEntrada(texto: string): ResultadoDaEntrada {
  const normalizado = normalizarParaPadroes(texto)
  if (casa(ALERTA_EMOCIONAL, normalizado)) return { resultado: "alerta", tipo: "emocional" }
  if (casa(ALERTA_FISICO, normalizado)) return { resultado: "alerta", tipo: "fisico" }
  if (casa(INJECTION, normalizado) || TAGS.test(texto)) return { resultado: "injection" }
  return { resultado: "ok" }
}
