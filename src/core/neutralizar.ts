const TROCAS: Record<string, string> = { "<": "‹", ">": "›" }

// Troca os colchetes angulares, para que o texto não feche ou abra blocos do prompt.
export function neutralizar(texto: string): string {
  return texto.replace(/[<>]/g, (c) => TROCAS[c] ?? c)
}
