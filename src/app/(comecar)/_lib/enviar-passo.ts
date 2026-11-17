import { toast } from "@/components/base/toast"
import { textoDoLimite } from "@/components/ritu/limites"

/** Com 429 de limite de toques, mostra o aviso por toast e devolve `true`. */
export async function avisarLimite(resposta: Response): Promise<boolean> {
  if (resposta.status !== 429) return false
  const { erro } = (await resposta.json().catch(() => ({}))) as { erro?: string }
  const retry = resposta.headers.get("Retry-After")
  const texto = textoDoLimite(erro ?? "", retry === null ? undefined : Number(retry))
  if (texto) toast(texto)
  return texto !== undefined
}

/**
 * Envia um passo do onboarding e devolve o `proximo` caminho. 401 volta à entrada; erro lança.
 * Com 429 de limite de toques, avisa por toast e devolve `undefined` (o passo não muda).
 */
export async function enviarPasso(url: string, corpo: unknown): Promise<string | undefined> {
  const resposta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  })
  if (resposta.status === 401) {
    window.location.assign("/")
    return new Promise<string>(() => {})
  }
  if (await avisarLimite(resposta)) return undefined
  if (!resposta.ok) throw new Error("falhou")
  const { proximo } = (await resposta.json()) as { proximo: string }
  return proximo
}
