import { config } from "@config/index"
import { z } from "zod"
import { conteudoDaPendenciaSchema } from "@/core/agents/companion/pergunta-do-run"
import { idEfetivo } from "@/core/agents/companion/registrar-entrega"
import {
  type SaidaDoAcompanhante,
  type SugestaoEntregue,
  saidaDoAcompanhanteSchema,
} from "@/core/agents/companion/saida"
import type { Retorno } from "@/core/outcomes/ports"
import type { PropostaNaSaida } from "@/core/proposals/conteudo"
import type { Proposta } from "@/core/proposals/ports"
import { pendenciaSchema } from "@/core/runs/checkpoint"
import type { Pergunta } from "@/core/runs/pergunta"
import type { Run, RunEtapa, TipoDeEtapa } from "@/core/runs/ports"
import { type FraseDeEtapa, frasesDoRun } from "./etapas"

export type ItemNaTela = {
  alimento_id: string
  nome: string
  verbos: string[]
  incerto: boolean
  troca?: { frase: string }
}

export type SugestaoNaTela = {
  posicao: number
  tipo: SugestaoEntregue["tipo"]
  titulo: string
  como_fazer: string
  itens: ItemNaTela[]
  verbos: string[]
  motivo: string
  novidade: boolean
  aviso?: string
  podeTrocar: boolean
}

export type VisaoDoRun = {
  run_id: string
  status: Run["status"]
  caminho: Run["caminho"]
  frases: FraseDeEtapa[]
  resposta?: string
  avisos: { tipo: "incomodo" | "geral"; texto: string }[]
  sugestoes: SugestaoNaTela[]
  evitar: string[]
  para_ter?: { nome: string; vezes: number; verbos: string[]; motivo: string }
  pergunta?: { estado: "aberta" | "seguiu" | "expirou" | "respondida"; pergunta: Pergunta }
  bloco?: {
    estado: "aberto" | "anotado" | "recusado" | "seguiu" | "expirou"
    linhas: { id: string; texto: string; decisao: Proposta["decisao"] }[]
  }
  voto?: "up" | "down"
  geral: boolean
  podeVotar: boolean
}

type EntradaDaVisao = {
  run: Run
  etapas: RunEtapa[]
  propostas: Proposta[]
  retornos: Retorno[]
  voto?: "up" | "down"
  agora: Date
}

const MS_POR_MINUTO = 60_000

// Tipos de etapa conhecidos pelo tradutor de frases; as etapas gravadas vêm só desses.
const TIPOS_DE_ETAPA: Record<TipoDeEtapa, true> = {
  interprete: true,
  llm: true,
  tool: true,
  validacao: true,
  pergunta: true,
  proposta: true,
  aprovacao: true,
  juiz: true,
  guardrail: true,
  troca_de_modelo: true,
  memoria: true,
  erro: true,
}
const CHAVES_DE_TIPO = new Set<string>(Object.keys(TIPOS_DE_ETAPA))

const RESPOSTA = z.object({ resposta: z.string() })

function ehTipoDeEtapa(tipo: string): tipo is TipoDeEtapa {
  return CHAVES_DE_TIPO.has(tipo)
}

function dentroDaEspera(criadaEm: string, agora: Date): boolean {
  const espera = agora.getTime() - new Date(criadaEm).getTime()
  return espera <= config.memoria.esperaMinutos * MS_POR_MINUTO
}

function frasesDaEtapas(etapas: RunEtapa[]): FraseDeEtapa[] {
  return frasesDoRun(
    etapas.flatMap((e) => (ehTipoDeEtapa(e.tipo) ? [{ tipo: e.tipo, nome: e.nome }] : [])),
  )
}

function respostaDoRun(saida: unknown): string | undefined {
  const lida = RESPOSTA.safeParse(saida)
  return lida.success && lida.data.resposta.trim() !== "" ? lida.data.resposta : undefined
}

function saidaValida(saida: unknown): SaidaDoAcompanhante | undefined {
  const lida = saidaDoAcompanhanteSchema.safeParse(saida)
  return lida.success ? lida.data : undefined
}

function estadoDaPergunta(
  status: Run["status"],
  criadaEm: string,
  agora: Date,
): "aberta" | "seguiu" | "expirou" | "respondida" {
  if (status === "waiting_for_input") return dentroDaEspera(criadaEm, agora) ? "aberta" : "expirou"
  if (status === "expired") return "expirou"
  if (status === "cancelled") return "seguiu"
  return "respondida"
}

function perguntaDoRun(run: Run, agora: Date): VisaoDoRun["pergunta"] {
  const pendencia = pendenciaSchema.safeParse(run.pendencia)
  if (!pendencia.success || pendencia.data.tipo !== "pergunta") return undefined
  const conteudo = conteudoDaPendenciaSchema.safeParse(pendencia.data.conteudo)
  if (!conteudo.success) return undefined
  return {
    estado: estadoDaPergunta(run.status, pendencia.data.criada_em, agora),
    pergunta: conteudo.data.pergunta,
  }
}

function linhasDoBloco(
  propostasDaSaida: PropostaNaSaida[],
  propostas: Proposta[],
): NonNullable<VisaoDoRun["bloco"]>["linhas"] {
  const decisoes = new Map(propostas.map((p) => [p.id, p.decisao]))
  return propostasDaSaida.map((p) => ({
    id: p.id,
    texto: p.texto,
    decisao: decisoes.get(p.id) ?? "pendente",
  }))
}

function estadoDoBlocoAguardando(run: Run, agora: Date): "aberto" | "expirou" {
  const pendencia = pendenciaSchema.safeParse(run.pendencia)
  const dentro = pendencia.success && dentroDaEspera(pendencia.data.criada_em, agora)
  return dentro ? "aberto" : "expirou"
}

function estadoDoBlocoFechado(
  run: Run,
  linhas: NonNullable<VisaoDoRun["bloco"]>["linhas"],
): "anotado" | "recusado" | "seguiu" {
  if (run.status !== "done") return "seguiu"
  const decisoes = linhas.map((l) => l.decisao)
  if (decisoes.includes("aprovada")) return "anotado"
  if (decisoes.length > 0 && decisoes.every((d) => d === "recusada")) return "recusado"
  return "seguiu"
}

function blocoDoRun(
  run: Run,
  saida: SaidaDoAcompanhante,
  propostas: Proposta[],
  agora: Date,
): VisaoDoRun["bloco"] {
  if (saida.propostas.length === 0) return undefined
  const linhas = linhasDoBloco(saida.propostas, propostas)
  if (run.status === "expired") return { estado: "expirou", linhas }
  if (run.status === "waiting_for_approval") {
    return { estado: estadoDoBlocoAguardando(run, agora), linhas }
  }
  return { estado: estadoDoBlocoFechado(run, linhas), linhas }
}

function itemNaTela(item: SugestaoEntregue["itens"][number]): ItemNaTela {
  const troca = item.troca
  return {
    alimento_id: idEfetivo(item),
    nome: troca?.nome ?? item.nome,
    verbos: troca?.verbos ?? item.verbos,
    incerto: item.casa === "incerto" && !troca,
    ...(troca ? { troca: { frase: troca.frase } } : {}),
  }
}

function podeTrocar(sugestao: SugestaoEntregue, retornos: Retorno[]): boolean {
  if (!sugestao.retorno_id) return false
  const id = sugestao.retorno_id
  return retornos.some((r) => r.id === id && r.status === "aguardando")
}

function sugestaoNaTela(
  sugestao: SugestaoEntregue,
  posicao: number,
  retornos: Retorno[],
): SugestaoNaTela {
  return {
    posicao,
    tipo: sugestao.tipo,
    titulo: sugestao.titulo,
    como_fazer: sugestao.como_fazer,
    itens: sugestao.itens.map(itemNaTela),
    verbos: sugestao.verbos,
    motivo: sugestao.motivo,
    novidade: sugestao.novidade,
    ...(sugestao.aviso !== undefined ? { aviso: sugestao.aviso } : {}),
    podeTrocar: podeTrocar(sugestao, retornos),
  }
}

function paraTerNaTela(saida: SaidaDoAcompanhante): VisaoDoRun["para_ter"] {
  const paraTer = saida.para_ter
  if (!paraTer) return undefined
  return {
    nome: paraTer.nome,
    vezes: paraTer.vezes,
    verbos: paraTer.verbos,
    motivo: paraTer.motivo,
  }
}

// Só o que a tela mostra: nada de checkpoint, tokens, modelos, clima usado nem linhas da base.
export function visaoDoRun(p: EntradaDaVisao): VisaoDoRun {
  const { run, etapas, propostas, retornos, voto, agora } = p
  const saida = saidaValida(run.saida)
  const resposta = respostaDoRun(run.saida)
  const pergunta = perguntaDoRun(run, agora)
  const bloco = saida ? blocoDoRun(run, saida, propostas, agora) : undefined
  const paraTer = saida ? paraTerNaTela(saida) : undefined
  return {
    run_id: run.id,
    status: run.status,
    caminho: run.caminho,
    frases: frasesDaEtapas(etapas),
    ...(resposta !== undefined ? { resposta } : {}),
    avisos: saida?.avisos ?? [],
    sugestoes: saida?.sugestoes.map((s, i) => sugestaoNaTela(s, i, retornos)) ?? [],
    evitar: saida?.evitar.map((e) => e.texto) ?? [],
    ...(paraTer ? { para_ter: paraTer } : {}),
    ...(pergunta ? { pergunta } : {}),
    ...(bloco ? { bloco } : {}),
    ...(voto ? { voto } : {}),
    geral: saida?.geral ?? false,
    podeVotar: resposta !== undefined,
  }
}
