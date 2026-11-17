import type { Clock } from "@/core/clock"
import type { ModelRouter } from "@/core/llm/router"
import type { Telemetry } from "@/core/telemetry/ports"
import type { UsageLimiter } from "./ports"

// Só os campos de Conta que os limites usam (sem importar accounts: evita ciclo de domínios).
// Uma Conta real é atribuível a este tipo.
export type ContaDoLimite = {
  id: string
  tipo: "google" | "demo"
  tester: boolean
  criado_em: string
}

export type MotivoDoLimite = "conta" | "demo" | "ip"

export type EstadoDasMensagens =
  | { tipo: "livre" } // tester
  | { tipo: "contando"; restantes: number; demo: boolean } // menor folga entre conta e IP
  | { tipo: "esgotadas"; motivo: MotivoDoLimite }

export type EstadoDaCota = { esgotada: false } | { esgotada: true; volta_as: string } // "5h"

export type EstadoDosLimites = { mensagens: EstadoDasMensagens; cota_ia: EstadoDaCota }

export type DepsDosLimites = {
  limiter: UsageLimiter
  router: ModelRouter
  clock: Clock
  telemetry: Telemetry
}

// `fuso`: o da cidade do perfil ou `clima.fusoPadrao` (só para a hora da virada)
// `teto`: só no modo e2e; substitui todos os tetos de mensagem e de toque deste pedido
export type QuemPede = {
  conta: ContaDoLimite
  ipHash: string
  fuso: string
  escopo?: string
  teto?: number
}
