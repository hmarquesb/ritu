import { z } from "zod"
import { funcaoSchema, gunaSchema } from "@/core/knowledge/vocab"

const itemDaEntregaSchema = z.object({
  alimento_id: z.string(),
  funcao: funcaoSchema.optional(),
  contribui: z.array(gunaSchema),
  linha_base: z.string(),
  se_faltar: z.string().optional(),
})

const sugestaoDaEntregaSchema = z.object({
  tipo: z.enum(["cha", "refeicao", "oleo", "pratica"]),
  pratica_id: z.string().optional(),
  preparo_id: z.string().optional(),
  itens: z.array(itemDaEntregaSchema),
  motivo: z.string(),
  linhas_base: z.array(z.string()),
  novidade: z.boolean(),
})

// Entrada da tool finalizar. Sem tetos de tamanho nem de quantidade: quem aponta é o validador.
export const entregaDoModeloSchema = z.object({
  resposta: z.string(),
  explicacao: z.object({
    qualidades_do_momento: z.array(gunaSchema),
    qualidades_buscadas: z.array(gunaSchema),
  }),
  sugestoes: z.array(sugestaoDaEntregaSchema),
  evitar: z.array(z.string()),
  incertos: z.array(z.string()),
  citados: z.array(z.string()),
  para_ter: z
    .object({
      alimento_id: z.string(),
      vezes: z.number(),
      contribui: z.array(gunaSchema),
      linha_base: z.string(),
    })
    .optional(),
})

export type EntregaDoModelo = z.infer<typeof entregaDoModeloSchema>
