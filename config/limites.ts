// Limites da entrada, das demonstrações e das buscas. Números ajustáveis ficam aqui, nunca no código.
export const limites = {
  demo: { porIpPorDia: 5, globalPorDia: 30, duracaoHoras: 24 },
  sessao: { dias: 30 },
  corpoMaximoBytes: 16_384,
  evitar: { maxItens: 20, textoLivreCaracteres: 40 },
  buscaDeAlimento: { minimoCaracteres: 2, maximoResultados: 8 },
  mensagens: { googlePorDia: 30, demoPorConta: 12, porIpPorDia: 60, avisarComRestantes: 3 },
  toques: { porContaPorMinuto: 60, porContaPorDia: 300, porIpPorDia: 1500 },
  mcp: { porIpPorMinuto: 30, porIpPorDia: 300, globalPorDia: 3000 },
} as const
