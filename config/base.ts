export const base = {
  minAlimentos: 130,
  minPreparos: 30,
  minPraticas: { cha: 20, oleo: 7, pratica: 17 },
  minAlimentosPorVaga: 3,
  minPraticasPorEstado: 3, // práticas com o estado em favorece_estados
  minPreparosPorEstado: 3, // preparos não contraindicados com alguma qualidade favorecida
  minPreparosPorMomento: 2,
  minPraticasPorMomento: 3,
  minCombinacoes: 8,
} as const
