// Checkpoints do eval com LLM (`QA.md`, "Checkpoints"). `pastas` são as pastas de casos que o checkpoint roda;
// `alvo` diz o que ele testa: o código do agente ("codigo") ou as rotas do site ("rotas").
export type AlvoDoCheckpoint = "codigo" | "rotas"

export const checkpoints = {
  "c1-base": { pastas: ["c1"], alvo: "codigo" },
  "c2-conversa": { pastas: ["c1", "c2"], alvo: "codigo" },
  "c3-confiavel": { pastas: ["c1", "c2", "c3"], alvo: "codigo" },
  "c4-site": { pastas: ["c1", "c2", "c3"], alvo: "rotas" },
  "c5-publico": { pastas: ["c1", "c2", "c3"], alvo: "rotas" },
} as const satisfies Record<string, { pastas: readonly string[]; alvo: AlvoDoCheckpoint }>
