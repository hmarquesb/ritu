import { z } from "zod"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { type Estado, estadoSchema } from "@/core/knowledge/vocab"

export const mensagemRecebidaSchema = z.object({
  texto: z.string().optional(),
  atalhos: z.array(estadoSchema),
})
export type MensagemRecebida = { texto?: string; atalhos: Estado[] }

// Texto que a pessoa vê e que o Intérprete lê: os atalhos viram "emoji rótulo", depois o texto livre.
export function textoDaMensagem(m: MensagemRecebida, kb: KnowledgeBase): string {
  const partes: string[] = []
  const atalhos = m.atalhos.map((id) => rotuloDoAtalho(id, kb)).join(" · ")
  if (atalhos) partes.push(atalhos)
  if (m.texto) partes.push(m.texto)
  return partes.join("\n")
}

function rotuloDoAtalho(id: Estado, kb: KnowledgeBase): string {
  const info = kb.estados.find((e) => e.id === id)
  return info ? `${info.emoji} ${info.rotulo}` : id
}
