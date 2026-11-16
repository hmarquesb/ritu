import { config } from "@config/index"
import { montarFiltro, sinaisDe } from "@/core/agents/companion/filtro-da-pessoa"
import { casaEAcabou } from "@/core/agents/companion/preparo"
import { idEfetivo, sugestaoRegistrada } from "@/core/agents/companion/registrar-entrega"
import {
  type SaidaDoAcompanhante,
  type SugestaoEntregue,
  saidaDoAcompanhanteSchema,
} from "@/core/agents/companion/saida"
import { type Substituto, substitutos } from "@/core/knowledge/substitutos"
import { verbosDasGunas } from "@/core/knowledge/verbos"
import { montarPergunta } from "@/core/runs/pergunta"
import type { Stores } from "@/core/stores"
import { diaLocal } from "@/core/time/dia-local"
import type { Deps } from "./deps"

type Item = SugestaoEntregue["itens"][number]

export type Alvo = {
  runId: string
  saida: SaidaDoAcompanhante
  bruta: object
  posicao: number
  sugestao: SugestaoEntregue
  retornoId: string
  item: Item
}

type Perfil = Awaited<ReturnType<Stores["profiles"]["ler"]>>

export type ContextoDaTroca = {
  candidatos: Substituto[]
  confirmados: Set<string>
  acabou: Set<string>
  incertos: string[]
}

/** Confere run, saída, posição, item e retorno aguardando. Undefined = toque inválido. */
export async function acharAlvo(
  s: Stores,
  contaId: string,
  p: { runId: string; sugestao: number; alimento_id: string },
): Promise<Alvo | undefined> {
  const run = await s.runs.buscar(contaId, p.runId)
  const saida = saidaDoAcompanhanteSchema.safeParse(run?.saida)
  if (!run || !saida.success) return undefined
  const sugestao = saida.data.sugestoes[p.sugestao]
  const item = sugestao?.itens.find((i) => idEfetivo(i) === p.alimento_id)
  const retornoId = sugestao?.retorno_id
  if (!sugestao || !item || !retornoId) return undefined
  const pendentes = await s.outcomes.pendentes(contaId)
  if (!pendentes.some((r) => r.id === retornoId)) return undefined
  return {
    runId: p.runId,
    saida: saida.data,
    bruta: run.saida as object,
    posicao: p.sugestao,
    sugestao,
    retornoId,
    item,
  }
}

export async function perfilEDia(
  deps: Deps,
  s: Stores,
  contaId: string,
): Promise<{ perfil: Perfil; dia: string }> {
  const perfil = await s.profiles.ler(contaId)
  return { perfil, dia: diaLocal(deps.clock.now(), perfil.cidade_fuso ?? undefined) }
}

/** Trocas já feitas neste item: a atual mais as que saíram (o original nunca entra em `anteriores`). */
function trocasFeitas(item: Item): number {
  return item.troca ? item.troca.anteriores.length + 1 : 0
}

export function noTeto(item: Item): boolean {
  return trocasFeitas(item) >= config.toques.maxTrocasPorItem
}

// Lê o perfil, a casa e as preferências depois do passo 2: o "não gosto" e o "acabou" já valem.
export async function contextoDaTroca(
  deps: Deps,
  s: Stores,
  contaId: string,
  alvo: Alvo,
  { perfil, dia }: { perfil: Perfil; dia: string },
): Promise<ContextoDaTroca> {
  const [evitarDoDia, preferencias] = await Promise.all([
    s.profiles.evitarTemporario(contaId, dia),
    s.preferences.ler(contaId),
  ])
  const { filtro } = montarFiltro({ perfil, evitarDoDia, evitarDaMensagem: [], preferencias })
  const { casa, acabou } = await casaEAcabou({ ...deps, stores: s }, contaId, filtro)
  const efetivo = idEfetivo(alvo.item)
  const outros = alvo.sugestao.itens.filter((i) => i !== alvo.item).map(idEfetivo)
  const fora = new Set([
    efetivo,
    ...outros,
    ...(alvo.item.troca?.anteriores ?? []),
    ...alvo.saida.evitar.map((e) => e.linha_base.replace(/^alimentos:/, "")),
  ])
  const lista = substitutos(
    {
      alimento_id: alvo.item.alimento_id,
      funcao: alvo.item.funcao,
      preparo_id: alvo.sugestao.preparo_id,
      outros_itens: outros,
      filtro,
      sinais: sinaisDe(preferencias, casa.confirmados),
      limite: config.toques.substitutosAvaliados,
    },
    deps.kb,
  ).filter((c) => !fora.has(c.alimento_id))
  return {
    candidatos: lista,
    confirmados: new Set(casa.confirmados),
    acabou: new Set(acabou),
    incertos: casa.incertos,
  }
}

export function perguntaDaTroca(
  deps: Deps,
  ctx: ContextoDaTroca,
): { alimento_id: string; nome: string; texto: string } | undefined {
  const c = ctx.candidatos.find(
    (x) => !ctx.confirmados.has(x.alimento_id) && !ctx.acabou.has(x.alimento_id),
  )
  if (!c) return undefined
  const texto = montarPergunta(
    { tipo: "casa", alimentos: [c.alimento_id], incertos: ctx.incertos },
    deps.kb,
  ).texto
  return { alimento_id: c.alimento_id, nome: c.nome, texto }
}

export async function aplicarTroca(
  deps: Deps,
  s: Stores,
  contaId: string,
  alvo: Alvo,
  substituto: Substituto,
): Promise<SugestaoEntregue> {
  const efetivo = idEfetivo(alvo.item)
  const contribui = alvo.item.contribui.filter((g) => substituto.em_comum.includes(g))
  const troca = {
    alimento_id: substituto.alimento_id,
    nome: substituto.nome,
    contribui,
    verbos: verbosDasGunas(contribui, deps.kb),
    linha_base: substituto.linha_base,
    frase: substituto.motivo,
    anteriores: [...(alvo.item.troca?.anteriores ?? []), ...(alvo.item.troca ? [efetivo] : [])],
  }
  const nova: SugestaoEntregue = {
    ...alvo.sugestao,
    itens: alvo.sugestao.itens.map((i) => (i === alvo.item ? { ...i, troca } : i)),
  }
  const sugestoes = alvo.saida.sugestoes.map((x, i) => (i === alvo.posicao ? nova : x))
  await s.runs.atualizar(contaId, alvo.runId, { saida: { ...alvo.bruta, sugestoes } })
  await s.outcomes.atualizarSugestao(contaId, alvo.retornoId, sugestaoRegistrada(nova))
  await s.preferences.marcarSugerido(contaId, [{ tipo: "alimento", id: substituto.alimento_id }])
  return nova
}
