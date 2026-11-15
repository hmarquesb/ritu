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

export const prakritiSchema = z
  .object({
    vata: z.number().min(0).max(1),
    pitta: z.number().min(0).max(1),
    kapha: z.number().min(0).max(1),
  })
  .refine((p) => Math.abs(p.vata + p.pitta + p.kapha - 1) <= 0.01, {
    message: "vata, pitta e kapha devem somar 1",
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
