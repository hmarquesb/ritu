// Forma do histórico do eval com LLM, em `evals/resultados/historico.json` (spec 014, lido pelos Bastidores na 023).
import { z } from "zod"

export const historicoSchema = z.object({
  versao: z.literal(1),
  checkpoints: z.array(
    z.object({
      checkpoint: z.string(),
      data: z.string(),
      prompts: z.record(z.string(), z.string()),
      modelos: z.array(z.string()),
      casos: z.number().int(),
      casos_com_erro: z.number().int(),
      metricas: z.record(
        z.string(),
        z.object({
          valor: z.number().nullable(),
          parte: z.number().optional(),
          total: z.number().optional(),
        }),
      ),
      violacoes_da_1a: z.record(z.string(), z.number().int()),
      abaixo_da_meta: z.array(z.string()),
      criticas: z.array(z.string()),
    }),
  ),
})

export type Historico = z.infer<typeof historicoSchema>
