// Faixas, janela de tendência, cache e busca de cidade do clima. Temperaturas em °C, umidade e chuva em %.
export const clima = {
  temperaturaAparente: { frioAbaixoDe: 20, quenteAcimaDe: 27 },
  umidade: { secoAbaixoDe: 50, umidoAcimaDe: 75 },
  tendencia: { horas: 6, variacaoMinima: 3 },
  chuva: { probabilidadeMinima: 50 },
  cacheMinutos: 60,
  timeoutMs: 4000,
  fusoPadrao: "America/Sao_Paulo",
  busca: { minimoCaracteres: 2, maximoResultados: 5, idioma: "pt" },
} as const
