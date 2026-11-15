import type { ItemDoDia } from "@/core/accounts/ports"
import type { Perfil } from "@/core/accounts/types"
import { montarAnotacoes } from "@/core/agents/companion/anotacoes"
import type { Anotacao } from "@/core/agents/companion/saida"
import type { Interpretacao } from "@/core/agents/interpreter/interpretacao"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { registrarResultado } from "@/core/outcomes/registrar"
import type { NovaEtapa } from "@/core/runs/ports"
import type { Stores, Transactor } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"
import { textoDeCasa, textoDeEvitar, textoDeRetorno, textosDaConversa } from "./textos"

export type CaminhoDeCodigo = "alerta" | "fora" | "ofensa" | "ajuda" | "casa" | "evitar" | "retorno"

export type ContextoDoCaminho = {
  stores: Stores
  tx: Transactor
  kb: KnowledgeBase
  telemetry: Telemetry
  contaId: string
  dia: string
  perfil: Perfil
  interpretacao: Interpretacao
}

export type ResultadoDeCodigo = { texto: string; anotacoes: Anotacao[]; etapa?: NovaEtapa }

// Etapa de guardrail de um caminho de código: a mensagem foi barrada, sem modelo e sem tokens (D9).
function etapaDeGuardrail(nome: string): NovaEtapa {
  return {
    tipo: "guardrail",
    nome,
    status: "recusado",
    resumo: null,
    duracao_ms: 0,
    modelo: null,
    tokens_entrada: 0,
    tokens_saida: 0,
  }
}

// D1/D3: o que a pessoa disse para evitar vale no dia, mesmo que já esteja no perfil.
export function itensDoDia(i: Interpretacao): ItemDoDia[] {
  const naoCome = i.nao_come.flatMap((c) =>
    c.alimento_id ? [{ tipo: "nao_come" as const, valor: c.alimento_id }] : [],
  )
  const restricoes = i.restricoes.map((valor) => ({ tipo: "restricao" as const, valor }))
  return [...i.evitar, ...naoCome, ...restricoes]
}

export async function gravarItensDoDia(ctx: ContextoDoCaminho): Promise<void> {
  const itens = itensDoDia(ctx.interpretacao)
  if (itens.length === 0) return
  await ctx.stores.profiles.acrescentarEvitarTemporario(ctx.contaId, ctx.dia, itens)
}

export async function anotacoesDaMensagem(ctx: ContextoDoCaminho): Promise<Anotacao[]> {
  const preferencias = await ctx.stores.preferences.ler(ctx.contaId)
  return montarAnotacoes(ctx.interpretacao, ctx.perfil, { kb: ctx.kb, preferencias })
}

export async function registrarRetornoDaConversa(ctx: ContextoDoCaminho): Promise<void> {
  const { retorno } = ctx.interpretacao
  if (!retorno?.retorno_id) return
  await registrarResultado(
    { tx: ctx.tx, telemetry: ctx.telemetry },
    ctx.contaId,
    retorno.retorno_id,
    retorno.resultado,
    "conversa",
  )
}

const semAnotacao = (texto: string): ResultadoDeCodigo => ({ texto, anotacoes: [] })

async function alerta(ctx: ContextoDoCaminho): Promise<ResultadoDeCodigo> {
  const fisico = ctx.interpretacao.alerta === "fisico"
  return {
    texto: fisico ? textosDaConversa.alertaFisico : textosDaConversa.alertaEmocional,
    anotacoes: [],
    etapa: etapaDeGuardrail(fisico ? "alerta_fisico" : "alerta_emocional"),
  }
}

async function fora(ctx: ContextoDoCaminho): Promise<ResultadoDeCodigo> {
  return {
    texto: textosDaConversa.fora,
    anotacoes: [],
    etapa: etapaDeGuardrail(ctx.interpretacao.suspeito ? "suspeito" : "fora"),
  }
}

async function casa(ctx: ContextoDoCaminho): Promise<ResultadoDeCodigo> {
  return {
    texto: textoDeCasa(ctx.interpretacao.itens_casa, ctx.kb),
    anotacoes: await anotacoesDaMensagem(ctx),
  }
}

async function evitar(ctx: ContextoDoCaminho): Promise<ResultadoDeCodigo> {
  await gravarItensDoDia(ctx)
  return {
    texto: textoDeEvitar(ctx.interpretacao, ctx.perfil, ctx.kb),
    anotacoes: await anotacoesDaMensagem(ctx),
  }
}

async function retorno(ctx: ContextoDoCaminho): Promise<ResultadoDeCodigo> {
  await registrarRetornoDaConversa(ctx)
  const citado = ctx.interpretacao.retorno
  return {
    texto: citado ? textoDeRetorno(citado) : textosDaConversa.retornoSemLigacao,
    anotacoes: await anotacoesDaMensagem(ctx),
  }
}

const CAMINHOS: Record<CaminhoDeCodigo, (ctx: ContextoDoCaminho) => Promise<ResultadoDeCodigo>> = {
  alerta,
  fora,
  ofensa: async () => semAnotacao(textosDaConversa.ofensa),
  ajuda: async () => semAnotacao(textosDaConversa.ajuda),
  casa,
  evitar,
  retorno,
}

export function ehCaminhoDeCodigo(caminho: string): caminho is CaminhoDeCodigo {
  return Object.hasOwn(CAMINHOS, caminho)
}

export function resolverCaminhoDeCodigo(
  caminho: CaminhoDeCodigo,
  ctx: ContextoDoCaminho,
): Promise<ResultadoDeCodigo> {
  return CAMINHOS[caminho](ctx)
}
