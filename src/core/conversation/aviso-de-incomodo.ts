import type { SaidaDoAcompanhante } from "@/core/agents/companion/saida"
import { textosDoAcompanhante } from "@/core/agents/companion/textos"

// Com incômodo, a saída final leva o aviso de incômodo, sem repetir o que já tem.
export function comAvisoDeIncomodo(
  saida: SaidaDoAcompanhante,
  incomodo: boolean,
): SaidaDoAcompanhante {
  if (!incomodo || saida.avisos.some((a) => a.tipo === "incomodo")) return saida
  const aviso = { tipo: "incomodo" as const, texto: textosDoAcompanhante.avisoIncomodo }
  return { ...saida, avisos: [...saida.avisos, aviso] }
}
