import { config } from "@config/index"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { type Guna, OPOSTO } from "@/core/knowledge/vocab"
import type { ItemDoCandidato } from "@/core/ranking/tipos"
import type { DadosDoPreparo } from "./preparo"
import type { EntregaDoModelo, EscolhaDoModelo } from "./saida"
import { idsEstruturados, linhasSoNoTexto, type Violacao } from "./validador"

export type ContextoDaMontagem = {
  dados: DadosDoPreparo
  clima?: { gunas: Guna[] }
  kb: KnowledgeBase
}

export type Montagem = { ok: true; entrega: EntregaDoModelo } | { ok: false; violacoes: Violacao[] }

type Escolhida = EscolhaDoModelo["sugestoes"][number]
type Candidato = DadosDoPreparo["candidatos"][number]
type ItemMontado = EntregaDoModelo["sugestoes"][number]["itens"][number]

const unicos = <T>(lista: T[]): T[] => [...new Set(lista)]

function doModelo(codigo: Violacao["codigo"], onde: string, mensagem: string): Violacao {
  return { codigo, onde, mensagem, origem: "modelo" }
}

function explicacaoDe(ctx: ContextoDaMontagem): EntregaDoModelo["explicacao"] {
  const clima = ctx.clima?.gunas ?? []
  const { presentes, buscadas } = ctx.dados.qualidades
  return {
    qualidades_do_momento: unicos([...presentes, ...clima]),
    qualidades_buscadas: unicos([...buscadas, ...clima.map((g) => OPOSTO[g])]),
  }
}

function itemMontado(item: ItemDoCandidato): ItemMontado {
  return {
    alimento_id: item.alimento_id,
    ...(item.funcao ? { funcao: item.funcao } : {}),
    contribui: item.contribui,
    linha_base: item.linha_base,
  }
}

function violacoesDasEscolhas(s: Escolhida, c: Candidato, i: number): Violacao[] {
  const escolhas = s.escolhas ?? []
  if (escolhas.length === 0) return []
  const onde = `sugestoes[${i}]`
  if (c.tipo !== "refeicao") {
    return [doModelo("estrutura", onde, "escolhas só valem para refeição; deixe escolhas vazio")]
  }
  if (!c.opcoes) {
    return [doModelo("estrutura", onde, "esse candidato não tem opções; use o item padrão")]
  }
  const opcoes = c.opcoes
  return escolhas.flatMap((e, j) => {
    const aqui = `${onde}.escolhas[${j}]`
    const lista = opcoes[e.funcao]
    if (!lista || !c.itens.some((it) => it.funcao === e.funcao)) {
      return [doModelo("estrutura", aqui, `a refeição ${c.id} não tem a vaga ${e.funcao}`)]
    }
    if (!lista.some((o) => o.alimento_id === e.alimento_id)) {
      const aceitas = lista.map((o) => o.alimento_id).join(", ")
      return [
        doModelo(
          "estrutura",
          aqui,
          `${e.alimento_id} não está nas opções da vaga ${e.funcao}; use um de: ${aceitas}`,
        ),
      ]
    }
    return []
  })
}

function itensDoCandidato(s: Escolhida, c: Candidato, ctx: ContextoDaMontagem): ItemMontado[] {
  const escolhas = new Map((s.escolhas ?? []).map((e) => [e.funcao, e.alimento_id]))
  const trocas = new Map((s.trocas ?? []).map((t) => [t.alimento_id, t.se_faltar]))
  const usadas = new Set<string>()
  return c.itens.map((padrao) => {
    const alvo = padrao.funcao ? escolhas.get(padrao.funcao) : undefined
    const opcao =
      padrao.funcao && alvo && !usadas.has(padrao.funcao)
        ? c.opcoes?.[padrao.funcao]?.find((o) => o.alimento_id === alvo)
        : undefined
    if (opcao && padrao.funcao) usadas.add(padrao.funcao)
    const item = itemMontado(opcao ?? padrao)
    const confirmado = ctx.dados.casa.confirmados.includes(item.alimento_id)
    const se_faltar = confirmado ? undefined : trocas.get(item.alimento_id)
    return se_faltar === undefined ? item : { ...item, se_faltar }
  })
}

function sugestaoMontada(
  s: Escolhida,
  c: Candidato,
  ctx: ContextoDaMontagem,
): EntregaDoModelo["sugestoes"][number] {
  return {
    tipo: c.tipo,
    ...(c.tipo === "refeicao" ? { preparo_id: c.id } : { pratica_id: c.id }),
    itens: itensDoCandidato(s, c, ctx),
    motivo: s.motivo,
    linhas_base: [c.linha_base],
    novidade: c.novidade,
  }
}

function paraTerMontado(
  e: EscolhaDoModelo,
  ctx: ContextoDaMontagem,
): { valor?: EntregaDoModelo["para_ter"]; violacoes: Violacao[] } {
  if (!e.para_ter) return { violacoes: [] }
  const base = ctx.dados.para_ter
  if (!base) {
    return {
      violacoes: [doModelo("para_ter", "para_ter", "o contexto não trouxe para_ter: tire o campo")],
    }
  }
  const { alimento_id, vezes, contribui, linha_base } = base
  return { valor: { alimento_id, vezes, contribui, linha_base }, violacoes: [] }
}

export function completarEntrega(e: EscolhaDoModelo, ctx: ContextoDaMontagem): Montagem {
  const violacoes: Violacao[] = []
  const aceitos = ctx.dados.candidatos.map((c) => c.id).join(", ") || "nenhum"
  const sugestoes: EntregaDoModelo["sugestoes"] = []
  e.sugestoes.forEach((s, i) => {
    const candidato = ctx.dados.candidatos.find((c) => c.id === s.id)
    if (!candidato) {
      violacoes.push(
        doModelo(
          "fora_dos_candidatos",
          `sugestoes[${i}]`,
          `${s.id} não é candidato; use um de: ${aceitos}`,
        ),
      )
      return
    }
    violacoes.push(...violacoesDasEscolhas(s, candidato, i))
    sugestoes.push(sugestaoMontada(s, candidato, ctx))
  })
  const paraTer = paraTerMontado(e, ctx)
  violacoes.push(...paraTer.violacoes)
  if (violacoes.length > 0) return { ok: false, violacoes }

  const entrega: EntregaDoModelo = {
    resposta: e.resposta,
    explicacao: explicacaoDe(ctx),
    sugestoes,
    evitar: ctx.dados.qualidades.evitar.map((x) => x.linha_base),
    incertos: e.incertos,
    citados: [],
    ...(paraTer.valor ? { para_ter: paraTer.valor } : {}),
  }
  const citados = linhasSoNoTexto(e.resposta, idsEstruturados(entrega, ctx.kb), ctx.kb)
  return {
    ok: true,
    entrega: { ...entrega, citados: citados.slice(0, config.resposta.maxCitados) },
  }
}

const CAMINHO = /^sugestoes\[(\d+)\]\.itens\[(\d+)\](\.se_faltar)?$/

function reescrever(v: Violacao, e: EscolhaDoModelo, entrega: EntregaDoModelo): Violacao {
  const m = CAMINHO.exec(v.onde)
  if (!m) return v
  const i = Number(m[1])
  const item = entrega.sugestoes[i]?.itens[Number(m[2])]
  const escolhida = e.sugestoes[i]
  if (!item || !escolhida) return { ...v, onde: `sugestoes[${i}]` }
  const mensagem = v.mensagem.replace("preencha se_faltar", "informe em trocas o se_faltar")
  if (m[3]) {
    const k = (escolhida.trocas ?? []).findIndex((t) => t.alimento_id === item.alimento_id)
    return { ...v, onde: k >= 0 ? `sugestoes[${i}].trocas[${k}]` : `sugestoes[${i}]`, mensagem }
  }
  const j = (escolhida.escolhas ?? []).findIndex(
    (x) => x.funcao === item.funcao && x.alimento_id === item.alimento_id,
  )
  return { ...v, onde: j >= 0 ? `sugestoes[${i}].escolhas[${j}]` : `sugestoes[${i}]`, mensagem }
}

/** Reescreve `onde` e `mensagem` das violações do modelo em termos da escolha, nunca `itens[j]`. */
export function emTermosDaEscolha(
  v: Violacao[],
  e: EscolhaDoModelo,
  entrega: EntregaDoModelo,
): Violacao[] {
  return v.map((x) => (x.origem === "modelo" ? reescrever(x, e, entrega) : x))
}
