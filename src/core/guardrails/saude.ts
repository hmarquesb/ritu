import { normalizarParaPadroes } from "./entrada"
import { SAUDE } from "./padroes"

export function falaDeSaude(texto: string): boolean {
  const normalizado = normalizarParaPadroes(texto)
  return SAUDE.some((p) => p.test(normalizado))
}
