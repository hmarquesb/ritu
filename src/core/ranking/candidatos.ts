import { config } from "@config/index"
import { notaAdequacao, type Prakriti } from "@/core/knowledge/adequacao"
import { candidatosDaVaga, type FiltroPessoa, passaNoFiltro } from "@/core/knowledge/filtros"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { MomentoQualidades } from "@/core/knowledge/momento"
import type { Alimento, Pratica, Preparo, Vaga } from "@/core/knowledge/schemas"
import type { Estado, Funcao, Guna, MomentoDoDia, Restricao } from "@/core/knowledge/vocab"
import type { ItemTipo, Preferencia } from "@/core/preferences/ports"
import type { Candidato, EstadoNaCasa, ItemDoCandidato, TipoDeSugestao } from "./tipos"

const { ranking } = config

type Entrada = {
  qualidades: MomentoQualidades
  estados: Estado[]
  momento_do_dia: MomentoDoDia
  filtro: FiltroPessoa
  prakriti?: Prakriti
  restricoes: Restricao[]
  casa: { confirmados: string[]; incertos: string[] }
  preferencias: Preferencia[]
  sugeridos_hoje: string[]
}

type Contexto = {
  entrada: Entrada
  kb: KnowledgeBase
  buscadas: Guna[]
  prefs: Map<string, Preferencia>
}

type Opcao = { item: ItemDoCandidato; adequacao: number; pontos: number }
type VagaComOpcoes = { vaga: Vaga; opcoes: Opcao[] }

// Dados de um candidato antes da nota, do gosto e do resultado, que entram em `fechar`.
type Base = {
  tipo: TipoDeSugestao
  id: string
  nome: string
  itens: ItemDoCandidato[]
  opcoes?: Candidato["opcoes"]
  contribui: Guna[]
  linha_base: string
  adequacao: number
}

const TIPOS: TipoDeSugestao[] = ["cha", "refeicao", "oleo", "pratica"]

const chave = (tipo: ItemTipo, id: string): string => `${tipo}:${id}`
const tipoDoItem = (tipo: TipoDeSugestao): ItemTipo => (tipo === "refeicao" ? "preparo" : "pratica")
const prefDe = (ctx: Contexto, tipo: ItemTipo, id: string): Preferencia | undefined =>
  ctx.prefs.get(chave(tipo, id))

function criarContexto(entrada: Entrada, kb: KnowledgeBase): Contexto {
  const prefs = new Map<string, Preferencia>(
    entrada.preferencias.map((p) => [chave(p.item_tipo, p.item_id), p] as const),
  )
  return { entrada, kb, buscadas: entrada.qualidades.buscadas, prefs }
}

function arredondar(valor: number): number {
  return Math.round(valor * 10) / 10
}

function media(valores: number[]): number {
  if (valores.length === 0) return 0
  return valores.reduce((soma, valor) => soma + valor, 0) / valores.length
}

function contribuiDe(gunas: Guna[], ctx: Contexto): Guna[] {
  return [...new Set(gunas)].filter((guna) => ctx.buscadas.includes(guna))
}

function adequacaoDe(item: { gunas: Guna[]; efeito?: Pratica["efeito"] }, ctx: Contexto): number {
  return notaAdequacao(item, ctx.buscadas, ctx.entrada.prakriti).nota
}

function casaDo(id: string, casa: Entrada["casa"]): EstadoNaCasa {
  if (casa.confirmados.includes(id)) return "confirmado"
  return casa.incertos.includes(id) ? "incerto" : "ausente"
}

function itemDo(alimento: Alimento, ctx: Contexto, funcao?: Funcao): ItemDoCandidato {
  return {
    alimento_id: alimento.id,
    nome: alimento.nome,
    ...(funcao ? { funcao } : {}),
    casa: casaDo(alimento.id, ctx.entrada.casa),
    contribui: contribuiDe(alimento.gunas, ctx),
    linha_base: `alimentos:${alimento.id}`,
  }
}

function pontosDaCasa(casa: EstadoNaCasa): number {
  if (casa === "confirmado") return ranking.casa.confirmado
  return casa === "incerto" ? ranking.casa.incerto : 0
}

// Candidato sem ingrediente recebe o ponto de "confirmado" inteiro.
function pontosDaCasaDoCandidato(itens: ItemDoCandidato[]): number {
  if (itens.length === 0) return ranking.casa.confirmado
  const soma = itens.reduce((total, item) => total + pontosDaCasa(item.casa), 0)
  return soma / itens.length
}

function pontosDoGosto(pref?: Preferencia): number {
  return pref?.gosto === "gosta" ? ranking.gosta : 0
}

function pontosDoResultado(pref?: Preferencia): number {
  const ajudou = Math.min(pref?.ajudou ?? 0, ranking.maximoDeAjudou) * ranking.porAjudou
  const naoAjudou =
    Math.min(pref?.nao_ajudou ?? 0, ranking.maximoDeNaoAjudou) * ranking.porNaoAjudou
  return ajudou + naoAjudou
}

function estaNoFim(pref?: Preferencia): boolean {
  const n = ranking.naoAjudouSeguidosParaOFim
  const ultimos = pref?.ultimos_resultados ?? []
  return ultimos.length >= n && ultimos.slice(0, n).every((r) => r === "nao_ajudou")
}

function temMarcaEvitada(alimento: Alimento, ctx: Contexto): boolean {
  return alimento.marcas.some((marca) => ctx.entrada.qualidades.evitar_marcas.includes(marca))
}

function avaliarOpcao(alimento: Alimento, funcao: Funcao, ctx: Contexto): Opcao {
  const item = itemDo(alimento, ctx, funcao)
  const adequacao = adequacaoDe(alimento, ctx)
  const pref = prefDe(ctx, "alimento", alimento.id)
  const pontos = adequacao + pontosDaCasa(item.casa) + pontosDoGosto(pref) + pontosDoResultado(pref)
  return { item, adequacao, pontos }
}

function compararOpcoes(a: Opcao, b: Opcao): number {
  return b.pontos - a.pontos || a.item.alimento_id.localeCompare(b.item.alimento_id)
}

// Opções de uma vaga: passam no filtro, sem marca evitada, ordenadas. O corte para o contexto é em `cortarParaOContexto`.
function opcoesDaVaga(vaga: Vaga, ctx: Contexto): Opcao[] {
  return candidatosDaVaga(vaga, ctx.kb)
    .filter((a) => !temMarcaEvitada(a, ctx) && passaNoFiltro(a, ctx.entrada.filtro, ctx.kb).passa)
    .map((a) => avaliarOpcao(a, vaga.funcao, ctx))
    .sort(compararOpcoes)
}

function opcoesDoPreparo(vagas: VagaComOpcoes[]): Candidato["opcoes"] {
  const pares = vagas
    .filter((v) => v.opcoes.length > 0)
    .map((v) => [v.vaga.funcao, v.opcoes.map((o) => o.item)] as const)
  return Object.fromEntries(pares)
}

// Regras que valem para prática e preparo: contraindicação, momento, "não gosta" e sugerido hoje.
function passaNoContexto(
  ctx: Contexto,
  alvo: { tipo: TipoDeSugestao; id: string; contraindicacoes: Estado[]; momento: MomentoDoDia[] },
): boolean {
  const { entrada } = ctx
  if (alvo.contraindicacoes.some((estado) => entrada.estados.includes(estado))) return false
  // Prática sem momento definido serve a qualquer momento do dia.
  if (alvo.momento.length > 0 && !alvo.momento.includes(entrada.momento_do_dia)) return false
  if (prefDe(ctx, tipoDoItem(alvo.tipo), alvo.id)?.gosto === "nao_gosta") return false
  const linha = alvo.tipo === "refeicao" ? `preparos:${alvo.id}` : `praticas:${alvo.id}`
  return !entrada.sugeridos_hoje.includes(linha)
}

function fechar(base: Base, ctx: Contexto): Candidato {
  const pref = prefDe(ctx, tipoDoItem(base.tipo), base.id)
  const { opcoes, ...resto } = base
  return {
    ...resto,
    ...(opcoes ? { opcoes } : {}),
    nota:
      base.adequacao +
      pontosDaCasaDoCandidato(base.itens) +
      pontosDoGosto(pref) +
      pontosDoResultado(pref),
    gosta: pref?.gosto === "gosta",
    ajudou: pref?.ajudou ?? 0,
    novidade: false,
    no_fim: estaNoFim(pref),
  }
}

function candidatoDoPreparo(preparo: Preparo, ctx: Contexto): Candidato | undefined {
  if (!passaNoFiltro(preparo, ctx.entrada.filtro, ctx.kb).passa) return undefined
  const vagas = preparo.vagas.map((vaga) => ({ vaga, opcoes: opcoesDaVaga(vaga, ctx) }))
  const obrigatorias = vagas.filter((v) => v.vaga.obrigatoria)
  // Vaga obrigatória sem opção tira o preparo.
  if (obrigatorias.some((v) => v.opcoes.length === 0)) return undefined
  const alvo = {
    tipo: "refeicao" as const,
    id: preparo.id,
    contraindicacoes: preparo.contraindicacoes,
    momento: preparo.momento,
  }
  if (!passaNoContexto(ctx, alvo)) return undefined

  const primeiras = obrigatorias.flatMap((v) => v.opcoes.slice(0, 1))
  const adequacao =
    adequacaoDe({ gunas: preparo.gunas_do_preparo }, ctx) +
    arredondar(media(primeiras.map((o) => o.adequacao)))
  if (adequacao <= 0) return undefined

  const itens = primeiras.map((o) => o.item)
  return fechar(
    {
      tipo: "refeicao",
      id: preparo.id,
      nome: preparo.nome,
      itens,
      opcoes: opcoesDoPreparo(vagas),
      contribui: contribuiDe(
        [...preparo.gunas_do_preparo, ...itens.flatMap((i) => i.contribui)],
        ctx,
      ),
      linha_base: `preparos:${preparo.id}`,
      adequacao,
    },
    ctx,
  )
}

function entraPratica(
  pratica: Pratica,
  alimentos: Alimento[],
  adequacao: number,
  ctx: Contexto,
): boolean {
  return (
    passaNoFiltro(pratica, ctx.entrada.filtro, ctx.kb).passa &&
    !alimentos.some((a) => temMarcaEvitada(a, ctx)) &&
    !pratica.nunca_sugerir_se.some((r) => ctx.entrada.restricoes.includes(r)) &&
    passaNoContexto(ctx, {
      tipo: pratica.tipo,
      id: pratica.id,
      contraindicacoes: pratica.contraindicacoes,
      momento: pratica.momento,
    }) &&
    adequacao > 0
  )
}

function candidatoDaPratica(pratica: Pratica, ctx: Contexto): Candidato | undefined {
  const alimentos = pratica.ingredientes.flatMap((id) => {
    const alimento = ctx.kb.alimento(id)
    return alimento ? [alimento] : []
  })
  const adequacao = adequacaoDe(pratica, ctx)
  if (!entraPratica(pratica, alimentos, adequacao, ctx)) return undefined
  return fechar(
    {
      tipo: pratica.tipo,
      id: pratica.id,
      nome: pratica.nome,
      itens: alimentos.map((a) => itemDo(a, ctx)),
      contribui: contribuiDe(pratica.gunas, ctx),
      linha_base: `praticas:${pratica.id}`,
      adequacao,
    },
    ctx,
  )
}

function compararNoTipo(a: Candidato, b: Candidato): number {
  if (a.no_fim !== b.no_fim) return a.no_fim ? 1 : -1
  return b.nota - a.nota || b.adequacao - a.adequacao || a.id.localeCompare(b.id)
}

function jaSugerido(candidato: Candidato, ctx: Contexto): boolean {
  return Boolean(prefDe(ctx, tipoDoItem(candidato.tipo), candidato.id)?.ultima_sugestao_em)
}

function escolherNovidade(candidatos: Candidato[], ctx: Contexto): Candidato | undefined {
  const elegiveis = candidatos.filter(
    (c) =>
      !jaSugerido(c, ctx) &&
      c.adequacao >= ranking.novidade.adequacaoMinima &&
      c.itens.every((item) => item.casa !== "ausente"),
  )
  return [...elegiveis].sort((a, b) => b.adequacao - a.adequacao || a.id.localeCompare(b.id))[0]
}

// A novidade ocupa no máximo a posição `novidade.posicaoMaxima` do seu tipo.
function encaixarNovidade(doTipo: Candidato[], escolhido: Candidato): Candidato[] {
  const resto = doTipo.filter((c) => c !== escolhido)
  const posicao = Math.min(doTipo.indexOf(escolhido), ranking.novidade.posicaoMaxima - 1)
  return [...resto.slice(0, posicao), { ...escolhido, novidade: true }, ...resto.slice(posicao)]
}

function marcarNovidade(candidatos: Candidato[], ctx: Contexto): Candidato[] {
  const temSugestao = ctx.entrada.preferencias.some((p) => p.ultima_sugestao_em !== null)
  if (!temSugestao) return candidatos
  const escolhido = escolherNovidade(candidatos, ctx)
  if (!escolhido) return candidatos
  return TIPOS.flatMap((tipo) => {
    const doTipo = candidatos.filter((c) => c.tipo === tipo)
    return doTipo.includes(escolhido) ? encaixarNovidade(doTipo, escolhido) : doTipo
  })
}

function isCandidato(c: Candidato | undefined): c is Candidato {
  return c !== undefined
}

// Quem entra, a nota, a ordem dentro de cada tipo e a novidade.
export function montarCandidatos(p: Entrada, kb: KnowledgeBase): Candidato[] {
  const ctx = criarContexto(p, kb)
  const todos = [
    ...kb.preparos.map((preparo) => candidatoDoPreparo(preparo, ctx)),
    ...kb.praticas.map((pratica) => candidatoDaPratica(pratica, ctx)),
  ].filter(isCandidato)
  const ordenados = TIPOS.flatMap((tipo) =>
    todos.filter((c) => c.tipo === tipo).sort(compararNoTipo),
  )
  return marcarNovidade(ordenados, ctx)
}

function cortarOpcoes(candidato: Candidato): Candidato {
  if (!candidato.opcoes) return candidato
  const max = ranking.noContexto.opcoesPorVaga
  const opcoes = Object.fromEntries(
    Object.entries(candidato.opcoes).map(([funcao, itens]) => [
      funcao,
      (itens ?? []).slice(0, max),
    ]),
  )
  return { ...candidato, opcoes }
}

// Mantém, por tipo, os primeiros de `ranking.noContexto` e limita as opções de cada vaga.
export function cortarParaOContexto(candidatos: Candidato[]): Candidato[] {
  const usados: Partial<Record<TipoDeSugestao, number>> = {}
  return candidatos.flatMap((candidato) => {
    const quantos = usados[candidato.tipo] ?? 0
    if (quantos >= ranking.noContexto[candidato.tipo]) return []
    usados[candidato.tipo] = quantos + 1
    return [cortarOpcoes(candidato)]
  })
}
