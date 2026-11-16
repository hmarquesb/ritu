// Checkpoints do eval com LLM: cada um roda as pastas de casos listadas (`QA.md`, "Checkpoints").
export const checkpoints = {
  "c1-base": ["c1"],
  "c2-conversa": ["c1", "c2"],
  "c3-confiavel": ["c1", "c2", "c3"],
} as const
