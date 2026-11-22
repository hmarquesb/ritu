import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { ItemTipo } from "@/core/preferences/ports"

// Nome do item na base (alimento, preparo ou prática); undefined: id fora da base desse tipo.
export function nomeNaBase(
  kb: KnowledgeBase,
  item: { tipo: ItemTipo; id: string },
): string | undefined {
  switch (item.tipo) {
    case "alimento":
      return kb.alimento(item.id)?.nome
    case "preparo":
      return kb.preparo(item.id)?.nome
    case "pratica":
      return kb.pratica(item.id)?.nome
  }
}
