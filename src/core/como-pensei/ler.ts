import type { Clock } from "@/core/clock"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Stores } from "@/core/stores"
import { type LinhaDoTempo, linhaDoTempo } from "./linha-do-tempo"

type Deps = { stores: Stores; kb: KnowledgeBase; clock: Clock }

/** Lê o run da conta e devolve a linha do tempo; run de outra conta ou inexistente é undefined. */
export async function lerComoPensei(
  deps: Deps,
  contaId: string,
  runId: string,
  fuso: string,
): Promise<LinhaDoTempo | undefined> {
  const { stores, kb, clock } = deps
  const run = await stores.runs.buscar(contaId, runId)
  if (!run) return undefined
  const [etapas, propostas] = await Promise.all([
    stores.runs.etapas(contaId, runId),
    stores.proposals.doRun(contaId, runId),
  ])
  return linhaDoTempo({ run, etapas, propostas, kb, agora: clock.now(), fuso })
}
