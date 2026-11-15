import { citadoNoPerfilDoNaoCome, itemNoPerfilDoEvitar } from "@/core/accounts/no-perfil"
import type { Perfil } from "@/core/accounts/types"
import type { Interpretacao, ItemDeCasaCitado } from "@/core/agents/interpreter/interpretacao"
import { type FiltroPessoa, passaNoFiltro } from "@/core/knowledge/filtros"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Preferencia } from "@/core/preferences/ports"
import type { Anotacao } from "./saida"

type Citado = { alimento_id?: string; nome: string }
type Extra = { kb: KnowledgeBase; preferencias: Preferencia[]; nao_come_do_run?: string[] }
type NaoCome = Extract<Anotacao, { tipo: "nao_come" }>

function copiaDoCitado(c: Citado): Citado {
  return c.alimento_id ? { alimento_id: c.alimento_id, nome: c.nome } : { nome: c.nome }
}

function itensDaAcao(i: Interpretacao, acao: ItemDeCasaCitado["acao"]): Citado[] {
  return i.itens_casa.filter((c) => c.acao === acao).map(copiaDoCitado)
}

// Só o id conta no filtro de alimentos: o "não como" livre não tem id e não filtra.
function filtroDoPerfil(perfil: Perfil): FiltroPessoa {
  return {
    evitar: perfil.evitar_sempre.map((g) => ({ tipo: g.tipo, valor: g.valor })),
    restricoes: perfil.restricoes,
    nao_come: perfil.nao_come.filter((item) => item.tipo === "alimento").map((item) => item.valor),
    nao_gosta: [],
  }
}

function gostaDeNovo(id: string, filtro: FiltroPessoa, extra: Extra): boolean {
  const alimento = extra.kb.alimento(id)
  if (!alimento || !passaNoFiltro(alimento, filtro, extra.kb).passa) return false
  return !extra.preferencias.some(
    (p) => p.item_tipo === "alimento" && p.item_id === id && p.gosto === "gosta",
  )
}

function candidatas(i: Interpretacao, perfil: Perfil, extra: Extra): Anotacao[] {
  const filtro = filtroDoPerfil(perfil)
  return [
    { tipo: "casa_tem", itens: itensDaAcao(i, "tem") },
    { tipo: "casa_acabou", itens: itensDaAcao(i, "acabou") },
    {
      tipo: "evitar_sempre",
      itens: i.evitar
        .filter((e) => !itemNoPerfilDoEvitar(e, perfil))
        .map((e) => ({ tipo: e.tipo, valor: e.valor })),
    },
    {
      tipo: "nao_come",
      itens: i.nao_come.filter((c) => !citadoNoPerfilDoNaoCome(c, perfil)).map(copiaDoCitado),
    },
    {
      tipo: "gosta",
      itens: i.gosta
        .filter((g) => gostaDeNovo(g.alimento_id, filtro, extra))
        .map((g) => ({ alimento_id: g.alimento_id, nome: g.nome })),
    },
    {
      tipo: "restricao",
      itens: i.restricoes.filter((r) => !perfil.restricoes.includes(r)),
    },
  ]
}

function semRepetirId(itens: Citado[]): Citado[] {
  const vistos = new Set<string>()
  return itens.filter((item) => {
    if (!item.alimento_id) return true
    if (vistos.has(item.alimento_id)) return false
    vistos.add(item.alimento_id)
    return true
  })
}

// O "não como" que a pessoa respondeu numa pergunta do run entra na anotação nao_come, sem repetir o que já está.
export function acrescentarNaoCome(
  anotacoes: Anotacao[],
  naoComeDoRun: string[],
  perfil: Perfil,
  kb: KnowledgeBase,
): Anotacao[] {
  const novos = naoComeDoRun.flatMap((id) => {
    const alimento = kb.alimento(id)
    if (!alimento || citadoNoPerfilDoNaoCome({ alimento_id: id, nome: alimento.nome }, perfil)) {
      return []
    }
    return [{ alimento_id: id, nome: alimento.nome }]
  })
  if (novos.length === 0) return anotacoes
  const existente = anotacoes.find((a): a is NaoCome => a.tipo === "nao_come")
  if (!existente) return [...anotacoes, { tipo: "nao_come", itens: semRepetirId(novos) }]
  const itens = semRepetirId([...existente.itens, ...novos])
  return anotacoes.map((a) => (a === existente ? { tipo: "nao_come", itens } : a))
}

// Vazio com alerta ou suspeito: nesses caminhos nenhuma anotação sai, nem o "não como" do run.
export function montarAnotacoes(i: Interpretacao, perfil: Perfil, extra: Extra): Anotacao[] {
  if (i.alerta || i.suspeito) return []
  const daMensagem = candidatas(i, perfil, extra).filter((a) => a.itens.length > 0)
  return acrescentarNaoCome(daMensagem, extra.nao_come_do_run ?? [], perfil, extra.kb)
}
