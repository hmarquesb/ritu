import { config } from "@config/index"
import { ESTADOS, type Estado } from "@/core/knowledge/vocab"
import type { TipoPadrao } from "./ports"
import {
  chaveDeAjuda,
  chaveDeJuntos,
  chaveDoItem,
  fraseDeAjuda,
  fraseDeAjudaCha,
  fraseDeJuntos,
  type ItemDoPadrao,
} from "./textos"

export type MomentoRegistrado = { dia: string; estados: Estado[] }

export type RetornoRegistrado = {
  dia: string
  estados: Estado[]
  item: ItemDoPadrao
  titulo: string
  resultado: "ajudou" | "nao_ajudou"
  respondido_em: string
}

export type PadraoDetectado = {
  tipo: TipoPadrao
  chave: string
  frase: string
  ocorrencias: number
}

type GrupoDeAjuda = {
  estados: Estado[]
  item: ItemDoPadrao
  ajudou: number
  naoAjudou: number
  titulo: string
  tituloEm: string
}

type CandidatoJuntos = { a: Estado; b: Estado; ocorrencias: number; proporcao: number }

function emOrdem(estados: Estado[]): Estado[] {
  return ESTADOS.filter((e) => estados.includes(e))
}

/** Todas as combinações (na ordem de ESTADOS) de 1 até `max` estados. */
function combinacoes(itens: Estado[], max: number): Estado[][] {
  const saida: Estado[][] = []
  const percorrer = (inicio: number, atual: Estado[]): void => {
    if (atual.length > 0) saida.push(atual)
    if (atual.length === max) return
    for (let i = inicio; i < itens.length; i++) {
      percorrer(i + 1, [...atual, itens[i] as Estado])
    }
  }
  percorrer(0, [])
  return saida
}

function somarRetorno(grupos: Map<string, GrupoDeAjuda>, r: RetornoRegistrado): void {
  for (const estados of combinacoes(emOrdem(r.estados), config.padroes.maxEstadosNaChave)) {
    const chave = chaveDeAjuda(estados, r.item)
    const grupo = grupos.get(chave) ?? {
      estados,
      item: r.item,
      ajudou: 0,
      naoAjudou: 0,
      titulo: r.titulo,
      tituloEm: r.respondido_em,
    }
    if (r.resultado === "ajudou") grupo.ajudou += 1
    else grupo.naoAjudou += 1
    if (r.respondido_em > grupo.tituloEm) {
      grupo.titulo = r.titulo
      grupo.tituloEm = r.respondido_em
    }
    grupos.set(chave, grupo)
  }
}

function valeAjuda(g: GrupoDeAjuda): boolean {
  const total = g.ajudou + g.naoAjudou
  return (
    g.ajudou >= config.padroes.minimoDeOcorrencias &&
    g.ajudou / total >= config.padroes.consistencia
  )
}

/** Entre dois grupos do mesmo item: mais "ajudou", depois mais estados, depois a chave menor. */
function ehMelhorDoItem(a: GrupoDeAjuda, b: GrupoDeAjuda): boolean {
  if (a.ajudou !== b.ajudou) return a.ajudou > b.ajudou
  if (a.estados.length !== b.estados.length) return a.estados.length > b.estados.length
  return chaveDeAjuda(a.estados, a.item) < chaveDeAjuda(b.estados, b.item)
}

function umGrupoPorItem(grupos: GrupoDeAjuda[]): GrupoDeAjuda[] {
  const porItem = new Map<string, GrupoDeAjuda>()
  for (const g of grupos) {
    const chaveItem = chaveDoItem(g.item)
    const atual = porItem.get(chaveItem)
    if (!atual || ehMelhorDoItem(g, atual)) porItem.set(chaveItem, g)
  }
  return [...porItem.values()]
}

function comoPadrao(g: GrupoDeAjuda): PadraoDetectado {
  return {
    tipo: "ajuda_em_estado",
    chave: chaveDeAjuda(g.estados, g.item),
    frase: g.item.tipo === "cha" ? fraseDeAjudaCha(g.estados) : fraseDeAjuda(g.estados, g.titulo),
    ocorrencias: g.ajudou,
  }
}

function porChave(a: PadraoDetectado, b: PadraoDetectado): number {
  if (a.chave === b.chave) return 0
  return a.chave < b.chave ? -1 : 1
}

/** "O que ajuda em um estado": por sugestão, o estado (ou par) com mais "ajudou" que vale. */
export function detectarAjudaEmEstado(retornos: RetornoRegistrado[]): PadraoDetectado[] {
  const grupos = new Map<string, GrupoDeAjuda>()
  for (const r of retornos) somarRetorno(grupos, r)
  const validos = [...grupos.values()].filter(valeAjuda)
  return umGrupoPorItem(validos).map(comoPadrao).sort(porChave)
}

function adicionarDia(mapa: Map<string, Set<string>>, chave: string, dia: string): void {
  const dias = mapa.get(chave) ?? new Set<string>()
  dias.add(dia)
  mapa.set(chave, dias)
}

function diasPorEstadoEPar(momentos: MomentoRegistrado[]): {
  porEstado: Map<string, Set<string>>
  porPar: Map<string, Set<string>>
} {
  const porEstado = new Map<string, Set<string>>()
  const porPar = new Map<string, Set<string>>()
  for (const m of momentos) {
    const estados = [...new Set(m.estados)]
    for (const a of estados) {
      adicionarDia(porEstado, a, m.dia)
      for (const b of estados) {
        if (a !== b) adicionarDia(porPar, chaveDeJuntos(a, b), m.dia)
      }
    }
  }
  return { porEstado, porPar }
}

function candidatosJuntos(momentos: MomentoRegistrado[]): CandidatoJuntos[] {
  const { porEstado, porPar } = diasPorEstadoEPar(momentos)
  const saida: CandidatoJuntos[] = []
  for (const a of ESTADOS) {
    for (const b of ESTADOS) {
      if (a === b) continue
      const diasA = porEstado.get(a)?.size ?? 0
      const ocorrencias = porPar.get(chaveDeJuntos(a, b))?.size ?? 0
      if (diasA === 0) continue
      const proporcao = ocorrencias / diasA
      const vale =
        ocorrencias >= config.padroes.minimoDeOcorrencias &&
        proporcao >= config.padroes.consistencia
      if (vale) saida.push({ a, b, ocorrencias, proporcao })
    }
  }
  return saida
}

function ordemDeEstados(x: Estado, y: Estado): number {
  return ESTADOS.indexOf(x) - ESTADOS.indexOf(y)
}

/** Dos dois sentidos de um mesmo par, fica o de maior proporção; no empate, o de `a` antes em ESTADOS. */
function umSentidoPorPar(candidatos: CandidatoJuntos[]): CandidatoJuntos[] {
  const ordenados = [...candidatos].sort(
    (x, y) => y.proporcao - x.proporcao || ordemDeEstados(x.a, y.a),
  )
  const vistos = new Map<string, CandidatoJuntos>()
  for (const c of ordenados) {
    const par = [c.a, c.b].sort(ordemDeEstados).join("|")
    if (!vistos.has(par)) vistos.set(par, c)
  }
  return [...vistos.values()]
}

/** "Estados que andam juntos": a e b no mesmo run, em dias que bastam e com consistência. */
export function detectarEstadosJuntos(momentos: MomentoRegistrado[]): PadraoDetectado[] {
  return umSentidoPorPar(candidatosJuntos(momentos))
    .map((c) => ({
      tipo: "estados_juntos" as const,
      chave: chaveDeJuntos(c.a, c.b),
      frase: fraseDeJuntos(c.a, c.b),
      ocorrencias: c.ocorrencias,
    }))
    .sort(porChave)
}
