import { config } from "@config/index"
import { notaAdequacao, type Prakriti } from "@/core/knowledge/adequacao"
import { type FiltroPessoa, passaNoFiltro } from "@/core/knowledge/filtros"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Alimento } from "@/core/knowledge/schemas"
import type { Guna } from "@/core/knowledge/vocab"
import type { Candidato, ItemDoCandidato, ParaTer } from "./tipos"

const { faltas: regras } = config.ranking

type Casa = { confirmados: string[]; incertos: string[] }
type FaltaComDias = { alimento_id: string; dias: number; ultimo_dia: string }
type ContextoFaltas = { buscadas: Guna[]; prakriti?: Prakriti; kb: KnowledgeBase }
type Avaliado = { candidato: Candidato; adequacao: number; ids: string[] }

function notaDoAlimento(alimento: Alimento, ctx: ContextoFaltas): number {
  return notaAdequacao(alimento, ctx.buscadas, ctx.prakriti).nota
}

function media(valores: number[]): number {
  if (valores.length === 0) return 0
  return valores.reduce((soma, valor) => soma + valor, 0) / valores.length
}

// O alimento de maior adequação entre as opções de uma vaga, sem olhar a casa.
function melhorDaVaga(opcoes: ItemDoCandidato[], ctx: ContextoFaltas): Alimento[] {
  const alimentos = opcoes.flatMap((opcao) => {
    const alimento = ctx.kb.alimento(opcao.alimento_id)
    return alimento ? [alimento] : []
  })
  const melhor = [...alimentos].sort(
    (a, b) => notaDoAlimento(b, ctx) - notaDoAlimento(a, ctx) || a.id.localeCompare(b.id),
  )[0]
  return melhor ? [melhor] : []
}

function avaliarRefeicao(candidato: Candidato, ctx: ContextoFaltas): Avaliado {
  const preparo = ctx.kb.preparo(candidato.id)
  if (!preparo) return { candidato, adequacao: candidato.adequacao, ids: [] }
  const melhores = preparo.vagas
    .filter((vaga) => vaga.obrigatoria)
    .flatMap((vaga) => melhorDaVaga(candidato.opcoes?.[vaga.funcao] ?? [], ctx))
  const doPreparo = notaAdequacao({ gunas: preparo.gunas_do_preparo }, ctx.buscadas, ctx.prakriti)
  return {
    candidato,
    adequacao: doPreparo.nota + media(melhores.map((a) => notaDoAlimento(a, ctx))),
    ids: melhores.map((a) => a.id),
  }
}

function avaliar(candidato: Candidato, ctx: ContextoFaltas): Avaliado {
  if (candidato.tipo === "refeicao") return avaliarRefeicao(candidato, ctx)
  return {
    candidato,
    adequacao: candidato.adequacao,
    ids: candidato.itens.map((item) => item.alimento_id),
  }
}

// Ordem só pela adequação; empate pelo id e pelo tipo, para ser estável.
function compararAvaliados(a: Avaliado, b: Avaliado): number {
  return (
    b.adequacao - a.adequacao ||
    a.candidato.id.localeCompare(b.candidato.id) ||
    a.candidato.tipo.localeCompare(b.candidato.tipo)
  )
}

// Alimentos dos candidatos mais adequados que a casa não tem (nem confirmados nem incertos).
export function faltasDoRun(
  p: { candidatos: Candidato[]; casa: Casa; prakriti?: Prakriti; buscadas: Guna[] },
  kb: KnowledgeBase,
): string[] {
  const ctx: ContextoFaltas = { buscadas: p.buscadas, prakriti: p.prakriti, kb }
  const maisAdequados = p.candidatos
    .map((candidato) => avaliar(candidato, ctx))
    .sort(compararAvaliados)
    .slice(0, regras.maisAdequados)
  const ids = new Set(maisAdequados.flatMap((avaliado) => avaliado.ids))
  return [...ids].filter((id) => !p.casa.confirmados.includes(id) && !p.casa.incertos.includes(id))
}

// Soma um dia a quem faltou hoje (uma vez só por dia).
function somarFaltasDeHoje(
  diasComFalta: FaltaComDias[],
  faltasDeHoje: string[],
  hoje: string,
): FaltaComDias[] {
  const porId = new Map(diasComFalta.map((falta) => [falta.alimento_id, falta] as const))
  for (const id of faltasDeHoje) {
    const atual = porId.get(id)
    if (atual?.ultimo_dia === hoje) continue
    porId.set(id, { alimento_id: id, dias: (atual?.dias ?? 0) + 1, ultimo_dia: hoje })
  }
  return [...porId.values()]
}

type Parametros = {
  diasComFalta: FaltaComDias[]
  faltasDeHoje: string[]
  hoje: string
  filtro: FiltroPessoa
  naLista: string[]
  recusados: string[]
  buscadas: Guna[]
}

function alimentoElegivel(id: string, p: Parametros, kb: KnowledgeBase): Alimento | undefined {
  const alimento = kb.alimento(id)
  if (!alimento) return undefined
  if (p.naLista.includes(id) || p.recusados.includes(id)) return undefined
  return passaNoFiltro(alimento, p.filtro, kb).passa ? alimento : undefined
}

type Escolhido = { falta: FaltaComDias; alimento: Alimento }

// Mais dias primeiro, depois o último dia mais recente, depois o nome menor.
function compararEscolhidos(a: Escolhido, b: Escolhido): number {
  return (
    b.falta.dias - a.falta.dias ||
    b.falta.ultimo_dia.localeCompare(a.falta.ultimo_dia) ||
    a.alimento.nome.localeCompare(b.alimento.nome)
  )
}

// O alimento para ter em casa: o que mais faltou entre os que chegaram ao mínimo de dias.
export function escolherParaTer(p: Parametros, kb: KnowledgeBase): ParaTer | undefined {
  const elegiveis = somarFaltasDeHoje(p.diasComFalta, p.faltasDeHoje, p.hoje).flatMap((falta) => {
    if (falta.dias < regras.minimoDeDias) return []
    const alimento = alimentoElegivel(falta.alimento_id, p, kb)
    return alimento ? [{ falta, alimento }] : []
  })
  const escolhido = [...elegiveis].sort(compararEscolhidos)[0]
  if (!escolhido) return undefined
  const { falta, alimento } = escolhido
  return {
    alimento_id: alimento.id,
    nome: alimento.nome,
    vezes: falta.dias,
    contribui: notaAdequacao(alimento, p.buscadas).contribui,
    linha_base: `alimentos:${alimento.id}`,
  }
}
