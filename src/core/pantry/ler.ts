import type { Clock } from "@/core/clock"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Stores } from "@/core/stores"
import { type CasaNaTela, visaoDaCasa } from "./visao"

type DepsDaCasa = { stores: Stores; kb: KnowledgeBase; clock: Clock }

export async function lerCasa(
  deps: DepsDaCasa,
  contaId: string,
  fuso: string,
): Promise<CasaNaTela> {
  const [itens, lista] = await Promise.all([
    deps.stores.pantry.listar(contaId),
    deps.stores.shortages.lista(contaId),
  ])
  const ids = [...new Set(itens.flatMap((item) => (item.alimento_id ? [item.alimento_id] : [])))]
  const preferencias =
    ids.length > 0
      ? await deps.stores.preferences.ler(
          contaId,
          ids.map((id) => ({ tipo: "alimento" as const, id })),
        )
      : []
  return visaoDaCasa({
    itens,
    lista,
    preferencias,
    kb: deps.kb,
    agora: deps.clock.now(),
    fuso,
  })
}
