import type { EntradaDoAcompanhante } from "@/core/agents/companion/entrada"
import type { Anotacao } from "@/core/agents/companion/saida"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { qualidadesDoMomento } from "@/core/knowledge/momento"
import { pendenciaSchema } from "@/core/runs/checkpoint"
import { type Pergunta, perguntaDaVariante } from "@/core/runs/pergunta"
import type { NovaEtapa } from "@/core/runs/ports"
import type { Stores } from "@/core/stores"

export const ETAPA_DA_VARIANTE: NovaEtapa = {
  tipo: "pergunta",
  nome: "variante",
  status: "ok",
  resumo: "variante",
  duracao_ms: 0,
  modelo: null,
  tokens_entrada: 0,
  tokens_saida: 0,
}

// Incômodo com mais de uma variante e nenhuma dita: a pergunta sai por código, antes do agente.
export function perguntaDaVariantePendente(
  entrada: EntradaDoAcompanhante,
  kb: KnowledgeBase,
): Pergunta | undefined {
  const { incomodo } = entrada
  if (!incomodo || incomodo.variante) return undefined
  const { precisa_variante: precisa } = qualidadesDoMomento(
    { estados: entrada.estados, incomodo },
    kb,
  )
  return precisa ? perguntaDaVariante(precisa) : undefined
}

// Acrescenta as anotações da mensagem à pendência que o loop gravou ao pausar.
export async function anotarPendencia(
  stores: Pick<Stores, "runs">,
  contaId: string,
  runId: string,
  anotacoes: Anotacao[],
): Promise<void> {
  const run = await stores.runs.buscar(contaId, runId)
  const lida = pendenciaSchema.safeParse(run?.pendencia)
  if (!lida.success) return
  const { conteudo } = lida.data
  const resto = typeof conteudo === "object" && conteudo !== null ? conteudo : {}
  await stores.runs.atualizar(contaId, runId, {
    pendencia: { ...lida.data, conteudo: { ...resto, anotacoes } },
  })
}
