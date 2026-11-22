import type { FiltroPessoa } from "@/core/knowledge/filtros"
import { passaNoFiltro } from "@/core/knowledge/filtros"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { TipoPadrao } from "./ports"
import { lerChave } from "./textos"

// Decide se um padrão confirmado vale hoje para a pessoa: o item da chave precisa existir na base
// e passar no filtro do run. "estados_juntos" vale sempre que a chave é válida.
export function padraoVale(
  p: { tipo: TipoPadrao; chave: string },
  filtro: FiltroPessoa,
  kb: KnowledgeBase,
): boolean {
  const lida = lerChave(p.tipo, p.chave)
  if (!lida) return false
  if (p.tipo === "estados_juntos") return true
  const item = lida.item
  if (!item) return false
  if (item.tipo === "cha") {
    return kb.praticas.some((p) => p.tipo === "cha" && passaNoFiltro(p, filtro, kb).passa)
  }
  const alvo = item.tipo === "pratica" ? kb.pratica(item.id) : kb.preparo(item.id)
  return !!alvo && passaNoFiltro(alvo, filtro, kb).passa
}
