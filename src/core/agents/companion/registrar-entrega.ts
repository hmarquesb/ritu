import type { SugestaoRegistrada } from "@/core/memory-schemas"
import type { SugestaoEntregue } from "./saida"

type ItemEntregue = SugestaoEntregue["itens"][number]

/** O id efetivo de um item é troca.alimento_id, ou alimento_id quando não há troca. */
export function idEfetivo(item: ItemEntregue): string {
  return item.troca?.alimento_id ?? item.alimento_id
}

export function sugestaoRegistrada(s: SugestaoEntregue): SugestaoRegistrada {
  return {
    tipo: s.tipo,
    ...(s.pratica_id ? { pratica_id: s.pratica_id } : {}),
    ...(s.preparo_id ? { preparo_id: s.preparo_id } : {}),
    titulo: s.titulo,
    alimentos: s.itens.map((item) => idEfetivo(item)),
  }
}
