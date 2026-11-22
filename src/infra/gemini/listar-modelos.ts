import { GoogleGenAI } from "@google/genai"

const TIMEOUT_MS = 10_000

// Recorte do SDK que a checagem usa; o teste injeta um falso.
export type ListarSdk = {
  models: {
    list(params: { config: { pageSize: number; abortSignal: AbortSignal } }): Promise<unknown>
  }
}

/** Pede a primeira página de modelos com a chave dada. Lança se a chave não responde. */
export async function listarModelos(
  chave: string,
  criar: (chave: string) => ListarSdk = (k) => new GoogleGenAI({ apiKey: k }),
): Promise<void> {
  await criar(chave).models.list({
    config: { pageSize: 1, abortSignal: AbortSignal.timeout(TIMEOUT_MS) },
  })
}
