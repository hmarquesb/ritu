import { config } from "@config/index"
import { toast } from "@/components/base/toast"

const MINUTO_S = 60

export function textoDoLimite(erro: string, retryAfterS?: number): string | undefined {
  if (erro !== "limite_toques") return undefined
  const { minuto, dia } = config.textosLimites.toques
  return retryAfterS !== undefined && retryAfterS <= MINUTO_S ? minuto : dia
}

// Resposta 429 de toque: mostra o aviso do limite e devolve `true`. Qualquer outra resposta fica como está.
export async function avisarLimiteDeToque(resposta: Response): Promise<boolean> {
  if (resposta.status !== 429) return false
  const cabecalho = resposta.headers.get("Retry-After")
  const corpo: unknown = await resposta
    .clone()
    .json()
    .catch(() => null)
  const erro = typeof corpo === "object" && corpo !== null && "erro" in corpo ? corpo.erro : null
  if (typeof erro !== "string") return false
  const texto = textoDoLimite(erro, cabecalho === null ? undefined : Number(cabecalho))
  if (texto === undefined) return false
  toast(texto)
  return true
}
