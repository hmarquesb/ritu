import { config } from "@config/index"
import type { ItemTemporario } from "@/core/accounts/ports"
import type { Perfil } from "@/core/accounts/types"
import type { EvitarItem, FiltroPessoa } from "@/core/knowledge/filtros"
import type { SinaisPessoa } from "@/core/knowledge/substitutos"
import type { Restricao } from "@/core/knowledge/vocab"
import type { Preferencia } from "@/core/preferences/ports"

type Entrada = {
  perfil: Perfil
  evitarDoDia: ItemTemporario[]
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

// "Não como" (id ou texto) e restrição do dia têm campo próprio: não entram em `evitar`.
function evitarDoDia(itens: ItemTemporario[]): EvitarItem[] {
  return itens.flatMap((item) =>
    item.tipo === "restricao" || item.tipo === "nao_come" || item.tipo === "nao_come_texto"
      ? []
      : [item],
  )
}

function restricoesDoDia(itens: ItemTemporario[]): Restricao[] {
  return itens.flatMap((item) => (item.tipo === "restricao" ? [item.valor] : []))
}

function naoComeDoDia(itens: ItemTemporario[]): string[] {
  return itens.flatMap((item) => (item.tipo === "nao_come" ? [item.valor] : []))
}

function naoComeTextoDoDia(itens: ItemTemporario[]): string[] {
  return itens.flatMap((item) => (item.tipo === "nao_come_texto" ? [item.valor] : []))
}

/** "Não como" da mensagem: id da base vira `nao_come`; nome livre vira `nao_come_texto`, cortado. */
export function itemDoNaoCome(n: { alimento_id?: string; nome: string }): ItemTemporario {
  if (n.alimento_id) return { tipo: "nao_come", valor: n.alimento_id }
  return { tipo: "nao_come_texto", valor: n.nome.slice(0, config.conversa.maxNomeLivre) }
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

  // Só itens de "evitar sempre" que não casam com a base, e o "não como" em texto do dia.
  const evitar_textos = [
    ...new Set([...valoresDoTipo(evitar, "texto"), ...naoComeTextoDoDia(p.evitarDoDia)]),
  ]

  return { filtro, evitar_textos }
}

/** Sinais da pessoa para a troca: a casa do run, o que gosta e o que já ajudou (só ajudou > 0). */
export function sinaisDe(preferencias: Preferencia[], emCasa: string[]): SinaisPessoa {
  const ajudou: Record<string, number> = {}
  for (const p of preferencias) if (p.ajudou > 0) ajudou[p.item_id] = p.ajudou
  return {
    em_casa: emCasa,
    gosta: preferencias.filter((p) => p.gosto === "gosta").map((p) => p.item_id),
    ajudou,
  }
}
