// Limites da entrada, das demonstrações e das buscas. Números ajustáveis ficam aqui, nunca no código.
export const limites = {
  demo: { porIpPorDia: 5, globalPorDia: 30, duracaoHoras: 24 },
  sessao: { dias: 30 },
  corpoMaximoBytes: 16_384,
  evitar: { maxItens: 20, textoLivreCaracteres: 40 },
  buscaDeAlimento: { minimoCaracteres: 2, maximoResultados: 8 },
} as const
