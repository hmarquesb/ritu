import { z } from "zod"

export const vercelConfigSchema = z
  .object({
    $schema: z.string(),
    regions: z.tuple([z.literal("gru1")]),
    git: z.object({ deploymentEnabled: z.literal(false) }),
    crons: z
      .array(
        z.object({
          path: z.string().startsWith("/api/cron/"),
          schedule: z.string(),
        }),
      )
      .min(1),
  })
  .strict()

const CRON_DIARIO = /^(\d{1,2}) (\d{1,2}) \* \* \*$/

// O plano Hobby da Vercel aceita cron só uma vez por dia, em horário fixo.
export function cronDiario(expr: string): boolean {
  const casa = CRON_DIARIO.exec(expr)
  if (!casa) {
    return false
  }
  const minuto = Number(casa[1])
  const hora = Number(casa[2])
  return minuto <= 59 && hora <= 23
}
