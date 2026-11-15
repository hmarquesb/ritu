import { z } from "zod"
import { estadoSchema, gunaSchema, momentoDoDiaSchema } from "./knowledge/vocab"

export const momentoSchema = z
  .object({
    estados: z.array(estadoSchema),
    momento_do_dia: momentoDoDiaSchema,
    gunas_buscadas: z.array(gunaSchema),
  })
  .strict()

export type Momento = z.infer<typeof momentoSchema>

export const sugestaoRegistradaSchema = z.object({
  tipo: z.enum(["cha", "refeicao", "oleo", "pratica"]),
  pratica_id: z.string().optional(),
  preparo_id: z.string().optional(),
  alimentos: z.array(z.string()),
  titulo: z.string(),
})

export type SugestaoRegistrada = z.infer<typeof sugestaoRegistradaSchema>

// Parcial, como o tipo Prakriti: os presentes devem somar 1 (folga de 0,01). Objeto vazio é recusado.
export const prakritiSchema = z
  .object({
    vata: z.number().min(0).max(1).optional(),
    pitta: z.number().min(0).max(1).optional(),
    kapha: z.number().min(0).max(1).optional(),
  })
  .refine((p) => Object.keys(p).length > 0, { message: "informe ao menos um dosha" })
  .refine((p) => Math.abs((p.vata ?? 0) + (p.pitta ?? 0) + (p.kapha ?? 0) - 1) <= 0.01, {
    message: "os doshas informados devem somar 1",
  })

export const evitarSempreSchema = z.array(
  z.object({
    tipo: z.enum(["grupo", "alimento", "texto"]),
    valor: z.string(),
    desde: z.string(),
  }),
)

export const naoComeSchema = z.array(
  z.object({
    tipo: z.enum(["alimento", "texto"]),
    valor: z.string(),
  }),
)
