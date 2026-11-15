import type { Perfil } from "@/core/accounts/types"
import type { EvitarItem, FiltroPessoa } from "@/core/knowledge/filtros"
import type { Preferencia } from "@/core/preferences/ports"

type Entrada = {
  perfil: Perfil
  evitarDoDia: EvitarItem[]
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

export function montarFiltro(p: Entrada): { filtro: FiltroPessoa; evitar_textos: string[] } {
  // Sem `desde`: o filtro e o prompt não recebem motivo nem data.
  const doPerfil: EvitarItem[] = p.perfil.evitar_sempre.map(({ tipo, valor }) => ({ tipo, valor }))
  const evitar = semRepetir([...doPerfil, ...p.evitarDoDia, ...p.evitarDaMensagem])
  const naoCome = p.perfil.nao_come

  const filtro: FiltroPessoa = {
    evitar,
    restricoes: [...p.perfil.restricoes],
    nao_come: [...new Set(valoresDoTipo(naoCome, "alimento"))],
    nao_gosta: [...new Set(naoGostaDeAlimento(p.preferencias))],
  }

  // Só itens de "evitar sempre" que não casam com a base. "Não como" tem campo próprio.
  const evitar_textos = [...new Set(valoresDoTipo(evitar, "texto"))]

  return { filtro, evitar_textos }
}
