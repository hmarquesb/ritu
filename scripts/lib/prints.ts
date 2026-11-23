/** Limite de cada print em WebP, em bytes (250 KB). */
export const LIMITE_BYTES = 250_000

const QUALIDADE_INICIAL = 80
const QUALIDADE_MINIMA = 5
const PASSO_DA_QUALIDADE = 5

export type Codificacao = { qualidade: number; bytes: Uint8Array }

/** Qualidades tentadas, da maior para a menor: 80, 75, … 5. */
export function qualidades(): number[] {
  const lista: number[] = []
  for (let q = QUALIDADE_INICIAL; q >= QUALIDADE_MINIMA; q -= PASSO_DA_QUALIDADE) lista.push(q)
  return lista
}

/**
 * Devolve a primeira codificação, da maior qualidade para a menor, que cabe no limite (inclusive).
 * `undefined` quando nenhuma cabe: quem chama falha com o nome do arquivo.
 */
export async function codificarAteCaber(
  codificar: (qualidade: number) => Promise<Uint8Array>,
  limite: number = LIMITE_BYTES,
): Promise<Codificacao | undefined> {
  for (const qualidade of qualidades()) {
    const bytes = await codificar(qualidade)
    if (bytes.byteLength <= limite) return { qualidade, bytes }
  }
  return undefined
}
