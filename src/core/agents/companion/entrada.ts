import { z } from "zod"
import { estadoSchema, restricaoSchema } from "@/core/knowledge/vocab"

export const intencaoSchema = z.enum(["momento", "pergunta", "vida", "casa", "retorno"])
export type Intencao = z.infer<typeof intencaoSchema>

export const casaDaMensagemSchema = z.object({
  tem: z.array(z.string()),
  acabou: z.array(z.string()),
})

export const retornoDaMensagemSchema = z.object({
  resultado: z.enum(["ajudou", "nao_ajudou", "nao_fez"]),
  titulo: z.string().optional(),
  registrado: z.boolean(),
})

export const entradaDoAcompanhanteSchema = z.object({
  texto: z.string().max(1000).optional(),
  intencoes: z.array(intencaoSchema).min(1),
  estados: z.array(estadoSchema),
  incomodo: z.object({ id: z.string(), variante: z.string().optional() }).optional(),
  evitar_da_mensagem: z.array(z.string()),
  casa_da_mensagem: casaDaMensagemSchema.optional(),
  retorno: retornoDaMensagemSchema.optional(),
  fato_de_rotina: z.string().optional(),
  nao_come_da_mensagem: z
    .array(z.object({ alimento_id: z.string().optional(), nome: z.string() }))
    .optional(),
  restricoes_da_mensagem: z.array(restricaoSchema).optional(),
})

export type EntradaDoAcompanhante = z.infer<typeof entradaDoAcompanhanteSchema>
