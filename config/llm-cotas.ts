// Modelos, cotas e ordem de uso por papel. Identificador de modelo fica aqui, versionado, nunca em variável de ambiente.
export const llmCotas = {
  fusoDoDia: "America/Los_Angeles",
  rateLimitsParaEsgotarODia: 3,
  timeoutMs: 15_000,
  modelos: {
    "gemini-3.5-flash-lite": { rpm: 15, tpm: 250_000, rpd: 500 },
    "gemini-3.1-flash-lite": { rpm: 15, tpm: 250_000, rpd: 500 },
    "gemini-2.5-flash-lite": { rpm: 10, tpm: 250_000, rpd: 20 },
    "gemini-3.8-flash": { rpm: 5, tpm: 250_000, rpd: 20 },
    "gemini-3.6-flash": { rpm: 5, tpm: 250_000, rpd: 20 },
    "gemini-3-flash-preview": { rpm: 5, tpm: 250_000, rpd: 20 },
    "gemini-2.5-flash": { rpm: 5, tpm: 250_000, rpd: 20 },
  },
  papeis: {
    decisao: [
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash-lite",
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
    ],
    apoio: ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-2.5-flash-lite"],
    reforco: [
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash-lite",
    ],
  },
} as const

export type Papel = keyof typeof llmCotas.papeis
