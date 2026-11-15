import { z } from "zod"
import { estadoSchema } from "@/core/knowledge/vocab"

export const intencaoSchema = z.enum(["momento", "pergunta", "vida", "casa", "retorno"])
export type Intencao = z.infer<typeof intencaoSchema>

export const entradaDoAcompanhanteSchema = z.object({
  texto: z.string().max(1000).optional(),
  intencoes: z.array(intencaoSchema).min(1),
  estados: z.array(estadoSchema),
  incomodo: z.object({ id: z.string(), variante: z.string().optional() }).optional(),
  evitar_da_mensagem: z.array(z.string()),
})

export type EntradaDoAcompanhante = z.infer<typeof entradaDoAcompanhanteSchema>
