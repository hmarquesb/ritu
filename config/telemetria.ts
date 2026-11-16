export const telemetria = {
  buckets: {
    ritu_run_duracao_ms: [250, 500, 1000, 2000, 4000, 8000, 15000, 30000, 60000],
    ritu_run_passos: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12],
    ritu_llm_duracao_ms: [250, 500, 1000, 2000, 4000, 8000, 15000, 30000],
    ritu_tool_duracao_ms: [5, 25, 100, 250, 500, 1000, 2500, 5000],
  },
  exportacaoNosScriptsMs: 5000,
  alertas: {
    cotaDoDia: 0.8,
    runsFalhando: { taxa: 0.1, minimoDeRuns: 5, janela: "1h" },
    juizReprovando: { taxa: 0.2, minimoDeJulgamentos: 5, janela: "1h" },
    semModelo: { minimo: 1, janela: "1h" },
    rateLimit: { minimo: 5, janela: "10m" },
  },
  grafana: {
    url: "http://localhost:3001",
    uidDoPainel: "ritu",
    pasta: "Ritu",
    uidMetricas: "prometheus",
  },
} as const
