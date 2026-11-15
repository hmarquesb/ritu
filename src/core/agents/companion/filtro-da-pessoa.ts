import type { ItemDoDia } from "@/core/accounts/ports"
import type { Perfil } from "@/core/accounts/types"
import type { EvitarItem, FiltroPessoa } from "@/core/knowledge/filtros"
import type { Restricao } from "@/core/knowledge/vocab"
import type { Preferencia } from "@/core/preferences/ports"

type Entrada = {
  perfil: Perfil
  evitarDoDia: ItemDoDia[]
  evitarDaMensagem: EvitarItem[]
  preferencias: Preferencia[]
}

const chaveDoItem = (item: EvitarItem): string => `${item.tipo}:${item.valor}`

function semRepetir(itens: EvitarItem[]): EvitarItem[] {
  const vistos = new Set<string>()
  return itens.filter((item) => {
    const chave = chaveDoItem(item)
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
}

function valoresDoTipo(itens: { tipo: string; valor: string }[], tipo: string): string[] {
  return itens.filter((item) => item.tipo === tipo).map((item) => item.valor)
}

// Preferência de "não gosta" só vale para alimento: o filtro guarda ids de alimento.
function naoGostaDeAlimento(preferencias: Preferencia[]): string[] {
  return preferencias
    .filter((p) => p.gosto === "nao_gosta" && p.item_tipo === "alimento")
    .map((p) => p.item_id)
}

// Restrição e "não como" do dia têm campo próprio: não entram em `evitar`.
function evitarDoDia(itens: ItemDoDia[]): EvitarItem[] {
  return itens.flatMap((item) =>
    item.tipo === "restricao" || item.tipo === "nao_come" ? [] : [item],
  )
}

function restricoesDoDia(itens: ItemDoDia[]): Restricao[] {
  return itens.flatMap((item) => (item.tipo === "restricao" ? [item.valor] : []))
}

function naoComeDoDia(itens: ItemDoDia[]): string[] {
  return itens.flatMap((item) => (item.tipo === "nao_come" ? [item.valor] : []))
}

export function montarFiltro(p: Entrada): { filtro: FiltroPessoa; evitar_textos: string[] } {
  // Sem `desde`: o filtro e o prompt não recebem motivo nem data.
  const doPerfil: EvitarItem[] = p.perfil.evitar_sempre.map(({ tipo, valor }) => ({ tipo, valor }))
  const evitar = semRepetir([...doPerfil, ...evitarDoDia(p.evitarDoDia), ...p.evitarDaMensagem])
  const naoCome = p.perfil.nao_come

  const filtro: FiltroPessoa = {
    evitar,
    restricoes: [...new Set([...p.perfil.restricoes, ...restricoesDoDia(p.evitarDoDia)])],
    nao_come: [...new Set([...valoresDoTipo(naoCome, "alimento"), ...naoComeDoDia(p.evitarDoDia)])],
    nao_gosta: [...new Set(naoGostaDeAlimento(p.preferencias))],
  }

  // Só itens de "evitar sempre" que não casam com a base. "Não como" tem campo próprio.
  const evitar_textos = [...new Set(valoresDoTipo(evitar, "texto"))]

  return { filtro, evitar_textos }
}
