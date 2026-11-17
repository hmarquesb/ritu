// Tela de conversa: intervalo e teto da consulta do run, teto de duração das rotas com streaming e o contador de caracteres.
export const telaConversa = {
  consultaDoRun: { intervaloMs: 2000, maximoMs: 90_000 },
  rotaMaxDurationS: 60, // maxDuration das rotas com streaming (teto do Hobby)
  contadorAPartirDe: 800, // caracteres: o contador aparece a partir daqui (maxCaracteres é o da 008)
} as const
