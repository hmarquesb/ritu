import type { bastidores } from "./bastidores"

// Rótulos em inglês dos destaques de Bastidores, para a tabela de números do README em inglês.
export const rotulosEn = {
  "trajetoria.correta": "Right lookups chosen",
  "fidelidade.motivos_fieis": "Reasons faithful to the base",
  "autocorrecao.corrigiu": "Fixed what the validator flagged",
  "seguranca.injection_bloqueada": "Blocked prompt injections",
  "custo.chamadas_decisao_por_run": "Decision calls per answer",
} as const satisfies Record<(typeof bastidores.destaques)[number], string>
