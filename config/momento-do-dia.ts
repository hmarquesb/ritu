// Horas inteiras, inclusivas. A faixa de `noite` atravessa a meia-noite (21h a 4h59).
export const momentoDoDia = {
  manha: { inicio: 5, fim: 10 },
  almoco: { inicio: 11, fim: 14 },
  tarde: { inicio: 15, fim: 17 },
  jantar: { inicio: 18, fim: 20 },
  noite: { inicio: 21, fim: 4 },
} as const
