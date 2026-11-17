import { config, textosComoFicou } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { nomeDoDosha } from "@/core/accounts/dosha"
import type { Perfil } from "@/core/accounts/types"
import type { EvitarItem, FiltroPessoa } from "@/core/knowledge/filtros"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Restricao } from "@/core/knowledge/vocab"
import type { CasaNaTela } from "@/core/pantry/visao"
import type { Padrao, StatusPadrao } from "@/core/patterns/ports"
import { padraoVale } from "@/core/patterns/vale"
import type { ItemTipo, Preferencia } from "@/core/preferences/ports"
import type { NotaDeRotina, ResumoDeRotina } from "@/core/routine/ports"
import type { ItemDaLista } from "@/core/shortages/ports"
import { diaLocal, diasEntre } from "@/core/time/dia-local"

export type ItemFixo = { tipo: "grupo" | "alimento" | "texto"; valor: string; nome: string }

export type MemoriaNaTela = {
  fixos: {
    dosha: { nome: string; origem: "quiz" | "declarado" } | null
    cidade: string | null
    evitar: ItemFixo[]
    restricoes: Restricao[]
    nao_come: ItemFixo[]
  }
  casa: { itens: number; incertos: number; acabou: number; na_lista: number }
  gostos: {
    item_tipo: ItemTipo
    item_id: string
    nome: string
    gosto: "gosta" | "nao_gosta" | null
    ajudou: number
    nao_ajudou: number
    nao_fez: number
  }[]
  faltas: { alimento_id: string; nome: string; dias: number; na_lista: boolean }[]
  rotina: { resumo: string | null; notas: { id: string; texto: string; criado_em: string }[] }
  padroes: { id: string; frase: string; status: StatusPadrao; decidido_em: string | null }[]
  conversa: { dia: string; nome: string; total: number }[]
}

type Entrada = {
  perfil: Perfil
  casa: CasaNaTela
  preferencias: Preferencia[]
  faltas: { alimento_id: string; dias: number }[]
  lista: ItemDaLista[]
  notas: NotaDeRotina[]
  resumo: ResumoDeRotina | undefined
  padroes: Padrao[]
  filtro: FiltroPessoa
  conversa: { dia: string; total: number }[]
  kb: KnowledgeBase
  agora: Date
  fuso: string
}

// Os sete níveis de "O que sei sobre você", já na ordem e com os nomes da tela. Não lança.
export function visaoDaMemoria(p: Entrada): MemoriaNaTela {
  const naLista = new Set(p.lista.map((item) => item.alimento_id))
  return {
    fixos: fixosNaTela(p.perfil, p.kb),
    casa: casaNaTela(p.casa, p.lista.length),
    gostos: gostosNaTela(p.preferencias, p.kb),
    faltas: faltasNaTela(p.faltas, naLista, p.kb),
    rotina: rotinaNaTela(p.notas, p.resumo),
    padroes: padroesNaTela(p.padroes, p.filtro, p.kb),
    conversa: conversaNaTela(p.conversa, p.agora, p.fuso),
  }
}

function fixosNaTela(perfil: Perfil, kb: KnowledgeBase): MemoriaNaTela["fixos"] {
  return {
    dosha:
      perfil.prakriti === null
        ? null
        : { nome: nomeDoDosha(perfil.prakriti, kb), origem: perfil.origem ?? "declarado" },
    cidade: perfil.cidade_nome,
    evitar: perfil.evitar_sempre.map((item) => itemFixo(item, kb)),
    restricoes: perfil.restricoes,
    nao_come: perfil.nao_come.map((item) => itemFixo(item, kb)),
  }
}

function itemFixo(item: EvitarItem, kb: KnowledgeBase): ItemFixo {
  return { tipo: item.tipo, valor: item.valor, nome: nomeDoEvitar(item, kb) }
}

function nomeDoEvitar(item: EvitarItem, kb: KnowledgeBase): string {
  if (item.tipo === "grupo") {
    return kb.gruposEvitar.find((grupo) => grupo.id === item.valor)?.nome ?? item.valor
  }
  if (item.tipo === "alimento") return kb.alimento(item.valor)?.nome ?? item.valor
  return item.valor
}

function casaNaTela(casa: CasaNaTela, naLista: number): MemoriaNaTela["casa"] {
  const prateleiras = casa.prateleiras.reduce((soma, p) => soma + p.itens.length, 0)
  return {
    itens: casa.ainda_tem.length + prateleiras + casa.acabou.length,
    incertos: casa.ainda_tem.length,
    acabou: casa.acabou.length,
    na_lista: naLista,
  }
}

// Só itens da base com gosto ou algum resultado; sem linha zerada.
function gostosNaTela(preferencias: Preferencia[], kb: KnowledgeBase): MemoriaNaTela["gostos"] {
  return preferencias
    .flatMap((pref) => {
      if (!temAlgo(pref)) return []
      const nome = nomeDoItem(pref.item_tipo, pref.item_id, kb)
      if (nome === undefined) return []
      return [
        {
          item_tipo: pref.item_tipo,
          item_id: pref.item_id,
          nome,
          gosto: pref.gosto,
          ajudou: pref.ajudou,
          nao_ajudou: pref.nao_ajudou,
          nao_fez: pref.nao_fez,
        },
      ]
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}

function temAlgo(pref: Preferencia): boolean {
  return pref.gosto !== null || pref.ajudou !== 0 || pref.nao_ajudou !== 0 || pref.nao_fez !== 0
}

function nomeDoItem(tipo: ItemTipo, id: string, kb: KnowledgeBase): string | undefined {
  if (tipo === "alimento") return kb.alimento(id)?.nome
  if (tipo === "pratica") return kb.pratica(id)?.nome
  return kb.preparo(id)?.nome
}

// Do alimento que mais dias fez falta para o que menos; fora da base, não aparece.
function faltasNaTela(
  faltas: { alimento_id: string; dias: number }[],
  naLista: Set<string>,
  kb: KnowledgeBase,
): MemoriaNaTela["faltas"] {
  return faltas
    .flatMap((falta) => {
      const alimento = kb.alimento(falta.alimento_id)
      if (!alimento) return []
      return [
        {
          alimento_id: falta.alimento_id,
          nome: alimento.nome,
          dias: falta.dias,
          na_lista: naLista.has(falta.alimento_id),
        },
      ]
    })
    .sort((a, b) => b.dias - a.dias || a.nome.localeCompare(b.nome, "pt-BR"))
}

function rotinaNaTela(
  notas: NotaDeRotina[],
  resumo: ResumoDeRotina | undefined,
): MemoriaNaTela["rotina"] {
  const ativas = notas
    .filter((nota) => nota.ativa)
    .sort((a, b) => Date.parse(b.criado_em) - Date.parse(a.criado_em))
  return {
    resumo: resumo?.texto ?? null,
    notas: ativas.map((nota) => ({ id: nota.id, texto: nota.texto, criado_em: nota.criado_em })),
  }
}

// Candidatos que valem hoje (do mais antigo), depois confirmados e recusados (do mais recente).
function padroesNaTela(
  padroes: Padrao[],
  filtro: FiltroPessoa,
  kb: KnowledgeBase,
): MemoriaNaTela["padroes"] {
  const candidatos = padroes
    .filter((p) => p.status === "candidato" && padraoVale(p, filtro, kb))
    .sort((a, b) => Date.parse(a.criado_em) - Date.parse(b.criado_em))
  const confirmados = doStatus(padroes, "confirmado")
  const recusados = doStatus(padroes, "recusado")
  return [...candidatos, ...confirmados, ...recusados].map((p) => ({
    id: p.id,
    frase: p.frase,
    status: p.status,
    decidido_em: p.decidido_em,
  }))
}

function doStatus(padroes: Padrao[], status: StatusPadrao): Padrao[] {
  return padroes
    .filter((p) => p.status === status)
    .sort((a, b) => dataDaDecisao(b) - dataDaDecisao(a))
}

function dataDaDecisao(p: Padrao): number {
  return Date.parse(p.decidido_em ?? p.criado_em)
}

// Dias com mensagem nos últimos `config.memoria.mensagensDias`, contando hoje, no fuso da pessoa.
function conversaNaTela(
  dias: { dia: string; total: number }[],
  agora: Date,
  fuso: string,
): MemoriaNaTela["conversa"] {
  const hoje = diaLocal(agora, fuso)
  const janela = config.memoria.mensagensDias
  return dias
    .flatMap((d) => {
      const n = diasEntre(d.dia, hoje)
      if (n < 0 || n >= janela) return []
      return [{ dia: d.dia, nome: nomeDoDia(n), total: d.total }]
    })
    .sort((a, b) => b.dia.localeCompare(a.dia))
}

function nomeDoDia(n: number): string {
  if (n === 0) return textosComoFicou.dia.hoje
  if (n === 1) return textosComoFicou.dia.ontem
  return formatar(textosComoFicou.dia.dias, { n })
}
