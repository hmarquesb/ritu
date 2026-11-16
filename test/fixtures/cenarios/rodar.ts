import type { RespostaDoRun } from "@/core/agents/companion/responder"
import type { ResultadoDaAprovacao } from "@/core/conversation/aprovar"
import type { RespostaDaConversa } from "@/core/conversation/conversar"
import type { Retorno } from "@/core/outcomes/ports"
import type { PropostaNaSaida } from "@/core/proposals/conteudo"
import type { EventoAoVivo } from "@/core/runs/loop"
import type { Pergunta, RespostaDaPessoa } from "@/core/runs/pergunta"
import type { ResultadoDaTroca } from "@/core/touches"
import type { DepsDoCenario } from "./montar"
import type { Cenario, Toque } from "./tipos"

// Teto de retomadas por cenário: uma pausa além disso deixa o run em waiting_for_input.
export const MAXIMO_DE_RETOMADAS = 3

type Final = RespostaDaConversa | RespostaDoRun

// O que cada toque devolveu; a troca traz a resposta só quando o toque tinha `resposta` e a troca perguntou.
export type ToqueFeito =
  | { tipo: "retorno"; retorno: Retorno }
  | { tipo: "gosto" }
  | { tipo: "troca"; resultado: ResultadoDaTroca; resposta?: ResultadoDaTroca }

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
  // Só vem quando o cenário tem toques: depois da aprovação e antes de `depois`.
  toques?: ToqueFeito[]
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

// O retorno do toque: `semeado` usa os ids de montarCenario; senão, o id da sugestão na saída do run.
function idDoRetornoDoToque(
  deps: DepsDoCenario,
  c: Cenario,
  final: Final,
  t: Extract<Toque, { tipo: "retorno" }>,
): string {
  const id = t.semeado
    ? deps.retornosSemeados[t.sugestao]
    : final.saida?.sugestoes[t.sugestao]?.retorno_id
  if (!id) throw new Error(`cenário ${c.nome}: toque de retorno sem id na sugestão ${t.sugestao}`)
  return id
}

// A troca pergunta por um candidato; se o toque tem `resposta`, responde essa pergunta.
async function tocarTroca(
  deps: DepsDoCenario,
  contaId: string,
  final: Final,
  t: Extract<Toque, { tipo: "troca" }>,
): Promise<ToqueFeito> {
  const runId = final.run_id
  const resultado = await deps.touches.trocarIngrediente(contaId, {
    runId,
    sugestao: t.sugestao,
    alimento_id: t.alimento_id,
    motivo: t.motivo,
  })
  if (resultado.resultado !== "perguntar" || !t.resposta) return { tipo: "troca", resultado }
  const resposta = await deps.touches.responderTroca(contaId, {
    runId,
    sugestao: t.sugestao,
    alimento_id: t.alimento_id,
    candidato: resultado.pergunta.alimento_id,
    resposta: t.resposta,
  })
  return { tipo: "troca", resultado, resposta }
}

async function tocarUm(
  deps: DepsDoCenario,
  contaId: string,
  c: Cenario,
  final: Final,
  t: Toque,
): Promise<ToqueFeito> {
  switch (t.tipo) {
    case "retorno": {
      const id = idDoRetornoDoToque(deps, c, final, t)
      return { tipo: "retorno", retorno: await deps.touches.tocarRetorno(contaId, id, t.resultado) }
    }
    case "gosto":
      await deps.touches.tocarGosto(contaId, t.item, t.gosto)
      return { tipo: "gosto" }
    case "troca":
      return tocarTroca(deps, contaId, final, t)
  }
}

// Os toques rodam um por vez, na ordem em que estão no cenário.
async function rodarToques(
  deps: DepsDoCenario,
  contaId: string,
  c: Cenario,
  final: Final,
): Promise<ToqueFeito[]> {
  const feitos: ToqueFeito[] = []
  for (const t of c.toques ?? []) feitos.push(await tocarUm(deps, contaId, c, final, t))
  return feitos
}

// Roda o cenário até o fim: a pessoa responde cada pausa, decide o bloco de aprovação, toca o que o cenário pede e, com `depois`, manda a segunda mensagem.
export async function rodarCenario(
  deps: DepsDoCenario,
  contaId: string,
  c: Cenario,
  opts: OpcoesDaRodada = {},
): Promise<RodadaDoCenario> {
  const primeira = await iniciarRodada(deps, contaId, c, opts)
  const { final, perguntas } = await rodarPausas(deps, contaId, c, opts, primeira)
  const bloco = await decidirBloco(deps, contaId, c, opts, final)
  const toques = c.toques?.length ? await rodarToques(deps, contaId, c, final) : undefined
  const rodada: RodadaDoCenario = {
    final,
    perguntas,
    ...(bloco ? { bloco } : {}),
    ...(toques ? { toques } : {}),
  }
  if (!c.depois) return rodada
  // A segunda mensagem roda até o fim sem decidir bloco: o de depois fica aberto.
  const inicio = await deps.conversation.conversar(contaId, c.depois.mensagem, {
    aoVivo: opts.aoVivo,
  })
  const segunda = await rodarPausas(deps, contaId, c, opts, inicio)
  return { ...rodada, depois: segunda }
}
