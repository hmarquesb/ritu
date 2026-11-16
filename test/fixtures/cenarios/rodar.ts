import type { RespostaDoRun } from "@/core/agents/companion/responder"
import type { ResultadoDaAprovacao } from "@/core/conversation/aprovar"
import type { RespostaDaConversa } from "@/core/conversation/conversar"
import type { PropostaNaSaida } from "@/core/proposals/conteudo"
import type { EventoAoVivo } from "@/core/runs/loop"
import type { Pergunta, RespostaDaPessoa } from "@/core/runs/pergunta"
import type { DepsDoCenario } from "./montar"
import type { Cenario } from "./tipos"

// Teto de retomadas por cenário: uma pausa além disso deixa o run em waiting_for_input.
const MAXIMO_DE_RETOMADAS = 3

type Final = RespostaDaConversa | RespostaDoRun

export type RodadaDoCenario = {
  // Resposta antes da aprovação (é o que a conversa devolveu no fim das pausas).
  final: Final
  perguntas: { pergunta: Pergunta; resposta: RespostaDaPessoa }[]
  // Só vem quando o bloco de aprovação foi decidido por `decidir` ou por `c.aprovacao`.
  bloco?: {
    propostas: PropostaNaSaida[]
    aprovadas: string[]
    resultado: ResultadoDaAprovacao
  }
  // Só vem com `c.depois`: a segunda mensagem, rodada até o fim.
  depois?: RodadaDoCenario
}

type OpcoesDaRodada = {
  aoVivo?: (e: EventoAoVivo) => void
  responder?: (p: Pergunta, i: number) => Promise<RespostaDaPessoa>
  // Decide o bloco de aprovação (ids aprovados); tem prioridade sobre `c.aprovacao`.
  decidir?: (propostas: PropostaNaSaida[]) => Promise<string[]>
}

async function respostaDaRodada(
  c: Cenario,
  opts: OpcoesDaRodada,
  pergunta: Pergunta,
  i: number,
): Promise<RespostaDaPessoa> {
  if (opts.responder) return opts.responder(pergunta, i)
  return c.respostas?.[i] ?? { tipo: "pular" }
}

// As pausas pedem resposta até o run terminar, no máximo MAXIMO_DE_RETOMADAS retomadas.
async function rodarPausas(
  deps: DepsDoCenario,
  contaId: string,
  c: Cenario,
  opts: OpcoesDaRodada,
  primeira: Final,
): Promise<{ final: Final; perguntas: RodadaDoCenario["perguntas"] }> {
  let final = primeira
  const perguntas: RodadaDoCenario["perguntas"] = []
  while (
    final.status === "waiting_for_input" &&
    final.pergunta &&
    perguntas.length < MAXIMO_DE_RETOMADAS
  ) {
    const pergunta: Pergunta = final.pergunta
    const resposta = await respostaDaRodada(c, opts, pergunta, perguntas.length)
    perguntas.push({ pergunta, resposta })
    final = await deps.conversation.continuar(contaId, final.run_id, resposta, {
      aoVivo: opts.aoVivo,
    })
  }
  return { final, perguntas }
}

// Ids do bloco que a pessoa aprova: `decidir`, ou as posições de `c.aprovacao`; sem nenhum, undefined (bloco aberto).
async function aprovadasDoBloco(
  c: Cenario,
  opts: OpcoesDaRodada,
  propostas: PropostaNaSaida[],
): Promise<string[] | undefined> {
  if (opts.decidir) return opts.decidir(propostas)
  if (c.aprovacao === undefined) return undefined
  if (c.aprovacao === "agora_nao") return []
  const posicoes = c.aprovacao.aprovar
  return propostas.filter((_, i) => posicoes.includes(i + 1)).map((p) => p.id)
}

// Aprova o bloco quando o run está esperando a aprovação com propostas e há decisão.
async function decidirBloco(
  deps: DepsDoCenario,
  contaId: string,
  c: Cenario,
  opts: OpcoesDaRodada,
  final: Final,
): Promise<RodadaDoCenario["bloco"]> {
  const propostas = final.saida?.propostas ?? []
  if (final.status !== "waiting_for_approval" || propostas.length === 0) return undefined
  const aprovadas = await aprovadasDoBloco(c, opts, propostas)
  if (aprovadas === undefined) return undefined
  const resultado = await deps.conversation.aprovar(contaId, final.run_id, aprovadas)
  return { propostas, aprovadas, resultado }
}

async function iniciarRodada(
  deps: DepsDoCenario,
  contaId: string,
  c: Cenario,
  opts: OpcoesDaRodada,
): Promise<Final> {
  if (c.mensagem) {
    return deps.conversation.conversar(contaId, c.mensagem, { aoVivo: opts.aoVivo })
  }
  if (c.entrada) {
    return deps.companion.responder(contaId, c.entrada, { aoVivo: opts.aoVivo })
  }
  throw new Error(`cenário ${c.nome} sem entrada nem mensagem`)
}

// Roda o cenário até o fim: a pessoa responde cada pausa, decide o bloco de aprovação e, com `depois`, manda a segunda mensagem.
export async function rodarCenario(
  deps: DepsDoCenario,
  contaId: string,
  c: Cenario,
  opts: OpcoesDaRodada = {},
): Promise<RodadaDoCenario> {
  const primeira = await iniciarRodada(deps, contaId, c, opts)
  const { final, perguntas } = await rodarPausas(deps, contaId, c, opts, primeira)
  const bloco = await decidirBloco(deps, contaId, c, opts, final)
  const rodada: RodadaDoCenario = { final, perguntas, ...(bloco ? { bloco } : {}) }
  if (!c.depois) return rodada
  // A segunda mensagem roda até o fim sem decidir bloco: o de depois fica aberto.
  const inicio = await deps.conversation.conversar(contaId, c.depois.mensagem, {
    aoVivo: opts.aoVivo,
  })
  const segunda = await rodarPausas(deps, contaId, c, opts, inicio)
  return { ...rodada, depois: segunda }
}
