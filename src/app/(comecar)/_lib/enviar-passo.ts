/** Envia um passo do onboarding e devolve o `proximo` caminho. 401 volta à entrada; erro lança. */
export async function enviarPasso(url: string, corpo: unknown): Promise<string> {
  const resposta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  })
  if (resposta.status === 401) {
    window.location.assign("/")
    return new Promise<string>(() => {})
  }
  if (!resposta.ok) throw new Error("falhou")
  const { proximo } = (await resposta.json()) as { proximo: string }
  return proximo
}
