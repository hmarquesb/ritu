/** E-mail para comparar: minúsculas, sem espaços nas pontas. */
export function normalizarEmail(e: string): string {
  return e.trim().toLowerCase()
}
