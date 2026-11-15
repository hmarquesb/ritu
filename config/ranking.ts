// Pesos e limites da ordenação dos candidatos do Acompanhante.
export const ranking = {
  casa: { confirmado: 3, incerto: 1 },
  gosta: 2,
  porAjudou: 1,
  maximoDeAjudou: 3,
  porNaoAjudou: -1,
  maximoDeNaoAjudou: 2,
  naoAjudouSeguidosParaOFim: 2,
  novidade: { adequacaoMinima: 4, posicaoMaxima: 3 },
  noContexto: { cha: 4, refeicao: 3, oleo: 2, pratica: 4, opcoesPorVaga: 3 },
  faltas: { maisAdequados: 5, minimoDeDias: 3, janelaDias: 30 },
} as const
