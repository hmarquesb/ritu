import { z } from "zod"

export const intencaoInterpretadaSchema = z.enum([
  "momento",
  "pergunta",
  "vida",
  "casa",
  "retorno",
  "evitar",
  "ajuda",
  "ofensa",
  "fora",
])

export type IntencaoInterpretada = z.infer<typeof intencaoInterpretadaSchema>

// Texto livre onde o modelo pode citar algo que a base não tem: a normalização descarta o que não existe.
export const saidaDoInterpreteSchema = z.object({
  intencoes: z.array(intencaoInterpretadaSchema),
  estados: z.array(z.string()),
  incomodo: z.object({ id: z.string(), variante: z.string().optional() }).optional(),
  alerta: z.enum(["fisico", "emocional"]).optional(),
  itens_casa: z.array(z.object({ nome: z.string(), acao: z.enum(["tem", "acabou"]) })),
  retorno: z
    .object({
      resultado: z.enum(["ajudou", "nao_ajudou", "nao_fez"]),
      pendente: z.number().int().optional(),
    })
    .optional(),
  fato_de_rotina: z.string().optional(),
  evitar_sempre: z.array(z.string()),
  nao_come: z.array(z.string()),
  gosta: z.array(z.string()),
  restricoes: z.array(z.string()),
  suspeito: z.boolean(),
})

export type SaidaDoInterprete = z.infer<typeof saidaDoInterpreteSchema>
