import type { EvitarItem } from "@/core/knowledge/filtros"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { neutralizar } from "@/core/neutralizar"

type Citado = { alimento_id?: string; nome: string }

// Nome de um item citado pela pessoa: o da base quando há alimento_id; o livre, neutralizado, quando não há.
export function nomeDoCitado(citado: Citado, kb: KnowledgeBase): string {
  if (citado.alimento_id) return kb.alimento(citado.alimento_id)?.nome ?? neutralizar(citado.nome)
  return neutralizar(citado.nome)
}

// Nome de um item de "evitar sempre": alimento e grupo pela base; texto livre, neutralizado.
export function nomeDoEvitar(item: EvitarItem, kb: KnowledgeBase): string {
  if (item.tipo === "alimento") return kb.alimento(item.valor)?.nome ?? item.valor
  if (item.tipo === "grupo") {
    return kb.gruposEvitar.find((grupo) => grupo.id === item.valor)?.nome ?? item.valor
  }
  return neutralizar(item.valor)
}
