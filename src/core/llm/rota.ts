/** Id da rota de um modelo: "<modelo>" com uma só chave, "<modelo>@<n>" com mais. */
export function rotaDe(modelo: string, chave: number, totalDeChaves: number): string {
  return totalDeChaves === 1 ? modelo : `${modelo}@${chave}`
}

/** Separa o id da rota; sem sufixo, é a chave 1. */
export function separarRota(rota: string): { modelo: string; chave: number } {
  const achado = /^(.+)@(\d+)$/.exec(rota)
  if (!achado) return { modelo: rota, chave: 1 }
  return { modelo: achado[1] as string, chave: Number(achado[2]) }
}
