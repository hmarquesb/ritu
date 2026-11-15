export type Limites = { rpm: number; tpm: number; rpd: number }

export type UsoDoModelo = {
  modelo: string
  minuto: { pedidos: number; tokens: number }
  dia: { pedidos: number; tokens: number; rate_limits: number }
  esgotado_ate?: "minuto" | "dia"
}

export interface UsageLedger {
  /** Soma 1 pedido nas duas janelas, ou não soma em nenhuma. */
  reservar(modelo: string, limites: Limites): Promise<boolean>
  registrarTokens(modelo: string, tokens: number): Promise<void>
  /** Esgota o minuto; no N-ésimo do dia, esgota o dia. */
  registrarRateLimit(modelo: string): Promise<void>
  uso(): Promise<UsoDoModelo[]>
  apagarAntigas(): Promise<number>
}
