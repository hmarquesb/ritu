import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { GRUPOS, type Grupo } from "@/core/knowledge/vocab"
import type { Preferencia } from "@/core/preferences/ports"
import type { ItemDaLista, MotivoDaLista } from "@/core/shortages/ports"
import { diaLocal } from "@/core/time/dia-local"
import { type EstadoCalculado, estadoDoItem } from "./estado"
import type { ItemDaCasa } from "./types"

export type ItemNaCasa = {
  id: string
  alimento_id: string | null
  nome: string
  grupo: Grupo | null
  estado: EstadoCalculado
  dias: number
  sempre_tenho: boolean
  gosto: "gosta" | "nao_gosta" | null
  na_lista: boolean
}

export type ItemDaListaNaTela = {
  alimento_id: string
  nome: string
  motivo: MotivoDaLista
  texto: string
}

export type CasaNaTela = {
  ainda_tem: ItemNaCasa[]
  prateleiras: { grupo: Grupo | "desconhecidos"; nome: string; itens: ItemNaCasa[] }[]
  acabou: ItemNaCasa[]
  lista: ItemDaListaNaTela[]
  vazia: boolean
}

type EntradaDaCasa = {
  itens: ItemDaCasa[]
  lista: ItemDaLista[]
  preferencias: Preferencia[]
  kb: KnowledgeBase
  agora: Date
  fuso: string
}

const DIA_EM_MS = 86_400_000

export function visaoDaCasa(p: EntradaDaCasa): CasaNaTela {
  const naLista = new Set(p.lista.map((item) => item.alimento_id))
  const gostos = new Map(
    p.preferencias
      .filter((pref) => pref.item_tipo === "alimento")
      .map((pref) => [pref.item_id, pref.gosto] as const),
  )
  const itens = p.itens.map((item) => itemNaCasa(item, p, naLista, gostos))
  return {
    ainda_tem: itens.filter((i) => i.estado === "incerto").sort(maisAntigoPrimeiro),
    prateleiras: prateleiras(
      itens.filter((i) => i.estado === "confirmado" || i.estado === "sempre_tenho"),
    ),
    acabou: itens.filter((i) => i.estado === "acabou").sort(porNome),
    lista: listaNaTela(p.lista, p.kb),
    vazia: p.itens.length === 0,
  }
}

export function textoDoMotivo(item: ItemDaLista): string {
  const texto = config.textosCasa.lista
  if (item.motivo === "pessoa") return texto.pessoa
  const modelo = item.motivo === "faltou_hoje" ? texto.faltouHoje : texto.fezFalta
  return formatar(modelo, { detalhe: item.detalhe })
}

function itemNaCasa(
  item: ItemDaCasa,
  p: EntradaDaCasa,
  naLista: Set<string>,
  gostos: Map<string, "gosta" | "nao_gosta" | null>,
): ItemNaCasa {
  const alimento = item.alimento_id ? p.kb.alimento(item.alimento_id) : undefined
  const grupo = alimento?.grupo ?? null
  return {
    id: item.id,
    alimento_id: item.alimento_id,
    nome: alimento?.nome ?? item.nome_livre ?? item.nome_normalizado ?? "",
    grupo,
    estado: estadoDoItem(item, p.agora, alimento?.durabilidade),
    dias: diasEntre(diaLocal(new Date(item.confirmado_em), p.fuso), diaLocal(p.agora, p.fuso)),
    sempre_tenho: item.sempre_tenho,
    gosto:
      grupo !== null && item.alimento_id !== null ? (gostos.get(item.alimento_id) ?? null) : null,
    na_lista: item.alimento_id !== null && naLista.has(item.alimento_id),
  }
}

function prateleiras(itens: ItemNaCasa[]): CasaNaTela["prateleiras"] {
  const chaves: (Grupo | "desconhecidos")[] = [...GRUPOS, "desconhecidos"]
  return chaves.flatMap((grupo) => {
    const doGrupo = itens.filter((i) => (i.grupo ?? "desconhecidos") === grupo).sort(porNome)
    if (doGrupo.length === 0) return []
    return [{ grupo, nome: nomeDoGrupo(grupo), itens: doGrupo }]
  })
}

function nomeDoGrupo(grupo: Grupo | "desconhecidos"): string {
  if (grupo === "desconhecidos") return config.textosCasa.prateleira.desconhecidos
  return config.textosCasa.grupos[grupo]
}

function listaNaTela(lista: ItemDaLista[], kb: KnowledgeBase): ItemDaListaNaTela[] {
  return [...lista]
    .sort((a, b) => Date.parse(b.criado_em) - Date.parse(a.criado_em))
    .flatMap((item) => {
      const alimento = kb.alimento(item.alimento_id)
      if (!alimento) return []
      return [
        {
          alimento_id: item.alimento_id,
          nome: alimento.nome,
          motivo: item.motivo,
          texto: textoDoMotivo(item),
        },
      ]
    })
}

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA_EM_MS)
}

function porNome(a: ItemNaCasa, b: ItemNaCasa): number {
  return a.nome.localeCompare(b.nome, "pt-BR")
}

function maisAntigoPrimeiro(a: ItemNaCasa, b: ItemNaCasa): number {
  return b.dias - a.dias || porNome(a, b)
}
