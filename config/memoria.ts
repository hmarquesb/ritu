// Prazos e limites da memória: janelas de contexto, espera de run e tamanho dos resumos no prompt.
export const memoria = {
  mensagensDias: 7,
  retornosDias: 7,
  faltasDias: 30,
  esperaMinutos: 30,
  rotinaNotasAtivas: 30,
  resumoRotinaCaracteres: 1200,
  padroesNoPrompt: 10,
  mensagensDoDiaNoPrompt: 6,
  historicoLinhas: 20,
} as const
