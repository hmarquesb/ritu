import type { MemoryAgent } from "@/core/agents/memory/memoria"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Stores, Transactor } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"
import { apagarNota, corrigirNota } from "./notas"
import type { NotaDeRotina } from "./ports"
import { atualizarResumo, type ResumoAtualizado } from "./resumo"

export function createRoutine(deps: {
  stores: Stores
  tx: Transactor
  memory: MemoryAgent
  kb: KnowledgeBase
  telemetry: Telemetry
}): {
  atualizarResumo(contaId: string): Promise<ResumoAtualizado>
  apagarNota(contaId: string, notaId: string): Promise<void>
  corrigirNota(contaId: string, notaId: string, texto: string): Promise<NotaDeRotina>
} {
  return {
    atualizarResumo: (contaId) => atualizarResumo(deps, contaId),
    apagarNota: (contaId, notaId) => apagarNota(deps, contaId, notaId),
    corrigirNota: (contaId, notaId, texto) => corrigirNota(deps, contaId, notaId, texto),
  }
}
