// Bastidores e servidor MCP público: janela dos números, mínimo de conversas, cache, retenção dos sinais e caminho do MCP.
export const bastidores = {
  dias: 7,
  minimoDeRuns: 20,
  topTools: 5,
  cacheMs: 3_600_000,
  retencaoSinaisDias: 30,
  toolsFora: ["ask_user", "finalizar", "memoria.propor", "lista.propor"],
  destaques: [
    "trajetoria.correta",
    "fidelidade.motivos_fieis",
    "autocorrecao.corrigiu",
    "seguranca.injection_bloqueada",
    "custo.chamadas_decisao_por_run",
  ],
  mcp: { caminho: "/api/mcp", corpoMaximoBytes: 16_384 },
} as const
