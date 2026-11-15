import type { Perfil } from "@/core/accounts/types"
import type { Interpretacao, ItemDeCasaCitado } from "@/core/agents/interpreter/interpretacao"
import { type EvitarItem, type FiltroPessoa, passaNoFiltro } from "@/core/knowledge/filtros"
import { normalizar } from "@/core/knowledge/identificar"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Preferencia } from "@/core/preferences/ports"
import type { Anotacao } from "./saida"

type Citado = { alimento_id?: string; nome: string }
type Extra = { kb: KnowledgeBase; preferencias: Preferencia[] }

function copiaDoCitado(c: Citado): Citado {
  return c.alimento_id ? { alimento_id: c.alimento_id, nome: c.nome } : { nome: c.nome }
}

function itensDaAcao(i: Interpretacao, acao: ItemDeCasaCitado["acao"]): Citado[] {
  return i.itens_casa.filter((c) => c.acao === acao).map(copiaDoCitado)
}

function evitarGuardado(item: EvitarItem, perfil: Perfil): boolean {
  return perfil.evitar_sempre.some((g) => g.tipo === item.tipo && g.valor === item.valor)
}

// Mesma comparação do texto de "não como" (conversation/textos.ts): por id, ou pelo nome normalizado.
function naoComeGuardado(c: Citado, perfil: Perfil): boolean {
  const tipo = c.alimento_id ? "alimento" : "texto"
  const valor = c.alimento_id ?? normalizar(c.nome)
  return perfil.nao_come.some((item) => item.tipo === tipo && item.valor === valor)
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
        .filter((e) => !evitarGuardado(e, perfil))
        .map((e) => ({ tipo: e.tipo, valor: e.valor })),
    },
    {
      tipo: "nao_come",
      itens: i.nao_come.filter((c) => !naoComeGuardado(c, perfil)).map(copiaDoCitado),
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

// Vazio com alerta ou suspeito: nesses caminhos nada do que foi citado vira anotação. Só sai o que é novo.
export function montarAnotacoes(i: Interpretacao, perfil: Perfil, extra: Extra): Anotacao[] {
  if (i.alerta || i.suspeito) return []
  return candidatas(i, perfil, extra).filter((a) => a.itens.length > 0)
}
