import { normalizar } from "@/core/knowledge/identificar"
import type { EntregaDoModelo } from "./saida"

// Sobre o texto normalizado (sem pontuação): por isso os padrões não trazem [.,].
export const PADROES_DE_DOSAGEM: RegExp[] = [
  /\b\d+\s?(mg|mcg|ui|g de extrato)\b/,
  /\b(capsula|comprimido|sache|ampola|gota)s?\b/,
  /\b(suplement\w+|fitoterap\w+|extrato de|tintura de|whey|multivitaminic\w+)\b/,
]

const MENSAGEM = "Sem dose, suplemento ou fitoterápico: fale só de alimento, tempero e prática."

export function temDosagem(texto: string): boolean {
  const normalizado = normalizar(texto)
  return PADROES_DE_DOSAGEM.some((padrao) => padrao.test(normalizado))
}

export function checarDosagem(
  entrega: EntregaDoModelo,
): { codigo: "dosagem"; onde: string; mensagem: string }[] {
  const campos: { onde: string; texto: string }[] = [
    { onde: "resposta", texto: entrega.resposta },
    ...entrega.sugestoes.map((s, i) => ({ onde: `sugestoes[${i}].motivo`, texto: s.motivo })),
    ...entrega.incertos.map((texto, i) => ({ onde: `incertos[${i}]`, texto })),
  ]
  return campos
    .filter((campo) => temDosagem(campo.texto))
    .map((campo) => ({ codigo: "dosagem", onde: campo.onde, mensagem: MENSAGEM }))
}
