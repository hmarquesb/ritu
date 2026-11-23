const MESES = [
  "jan.",
  "fev.",
  "mar.",
  "abr.",
  "mai.",
  "jun.",
  "jul.",
  "ago.",
  "set.",
  "out.",
  "nov.",
  "dez.",
]

/** "2026-12-03" vira "3 de dez."; texto fora do formato volta como veio. */
export function dataCurta(dia: string): string {
  const [, mes, diaDoMes] = /^\d{4}-(\d{2})-(\d{2})/.exec(dia) ?? []
  const nome = MESES[Number(mes) - 1]
  if (!nome || !diaDoMes) return dia
  return `${Number(diaDoMes)} de ${nome}`
}
