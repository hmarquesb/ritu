import type { Clock } from "@/core/clock"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Stores } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"
import { apagarPadrao, decidirPadrao } from "./decidir"
import { detectarPadroes, detectarPadroesDaConta, type ResultadoDaDeteccao } from "./job"

export function createPatterns(deps: {
  stores: Stores
  kb: KnowledgeBase
  clock: Clock
  telemetry: Telemetry
}): {
  detectarPadroes(): Promise<ResultadoDaDeteccao>
  detectarPadroesDaConta(contaId: string): Promise<number>
  decidirPadrao(
    contaId: string,
    padraoId: string,
    decisao: "confirmado" | "recusado",
  ): Promise<void>
  apagarPadrao(contaId: string, padraoId: string): Promise<void>
} {
  return {
    detectarPadroes: () => detectarPadroes(deps),
    detectarPadroesDaConta: (contaId) => detectarPadroesDaConta(deps, contaId),
    decidirPadrao: (contaId, padraoId, decisao) => decidirPadrao(deps, contaId, padraoId, decisao),
    apagarPadrao: (contaId, padraoId) => apagarPadrao(deps, contaId, padraoId),
  }
}
