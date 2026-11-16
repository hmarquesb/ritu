// Limites dos padrões de rotina: mínimo de dias para propor (3), consistência para o padrão valer (0,75 = 75%), janela de dias analisados (60), estados por chave (2), candidatos abertos por conta (3), runs analisados por conta (400) e vezes sem resposta até o bloco sumir (3).
export const padroes = {
  minimoDeOcorrencias: 3,
  consistencia: 0.75,
  janelaDias: 60,
  maxEstadosNaChave: 2,
  maxCandidatosAbertos: 3,
  runsPorConta: 400,
  bloco: { vezesSemResposta: 3 },
} as const
