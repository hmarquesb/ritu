export const base = {
  minAlimentos: 130,
  minPreparos: 30,
  minPraticas: { cha: 20, oleo: 7, pratica: 17 },
  minAlimentosPorVaga: 3,
  excecoesMinAlimentosPorVaga: [
    "leite-morno-com-especiaria:liquido",
    "tapioca-recheada:base",
    "cuscuz-no-vapor:base",
    "torrada-com-gordura:base",
    "macarrao-com-legume:base",
    "polenta-mole:base",
  ],
  minPraticasPorEstado: 3, // práticas com o estado em favorece_estados
  minPreparosPorEstado: 3, // preparos não contraindicados com alguma qualidade favorecida
  minPreparosPorMomento: 2,
  minPraticasPorMomento: 3,
  minCombinacoes: 8,
} as const
