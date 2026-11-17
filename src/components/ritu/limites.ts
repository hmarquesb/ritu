import { config } from "@config/index"

const MINUTO_S = 60

export function textoDoLimite(erro: string, retryAfterS?: number): string | undefined {
  if (erro !== "limite_toques") return undefined
  const { minuto, dia } = config.textosLimites.toques
  return retryAfterS !== undefined && retryAfterS <= MINUTO_S ? minuto : dia
}
