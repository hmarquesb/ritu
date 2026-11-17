import { z } from "zod"

// Cidade escolhida pela pessoa (017): usada pelo onboarding e pelos toques de perfil (020).
export function fusoValido(fuso: string): boolean {
  try {
    Intl.DateTimeFormat("pt-BR", { timeZone: fuso }).resolvedOptions()
    return true
  } catch {
    return false
  }
}

export const cidadeSchema = z.strictObject({
  nome: z.string().trim().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  fuso: z.string().refine(fusoValido, "fuso_invalido"),
})
