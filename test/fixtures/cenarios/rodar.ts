import type { RespostaDoRun } from "@/core/agents/companion/responder"
import type { RespostaDaConversa } from "@/core/conversation/conversar"
import type { EventoAoVivo } from "@/core/runs/loop"
import type { Pergunta, RespostaDaPessoa } from "@/core/runs/pergunta"
import type { DepsDoCenario } from "./montar"
import type { Cenario } from "./tipos"

// Teto de retomadas por cenário: uma pausa além disso deixa o run em waiting_for_input.
const MAXIMO_DE_RETOMADAS = 3

export type RodadaDoCenario = {
  final: RespostaDaConversa | RespostaDoRun
  perguntas: { pergunta: Pergunta; resposta: RespostaDaPessoa }[]
}

type OpcoesDaRodada = {
  aoVivo?: (e: EventoAoVivo) => void
  responder?: (p: Pergunta, i: number) => Promise<RespostaDaPessoa>
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

// Roda o cenário até o fim: a pessoa responde cada pausa (respostas do cenário ou `responder`), no máximo 3 retomadas.
export async function rodarCenario(
  deps: DepsDoCenario,
  contaId: string,
  c: Cenario,
  opts: OpcoesDaRodada = {},
): Promise<RodadaDoCenario> {
  let final: RespostaDaConversa | RespostaDoRun
  if (c.mensagem) {
    final = await deps.conversation.conversar(contaId, c.mensagem, { aoVivo: opts.aoVivo })
  } else if (c.entrada) {
    final = await deps.companion.responder(contaId, c.entrada, { aoVivo: opts.aoVivo })
  } else {
    throw new Error(`cenário ${c.nome} sem entrada nem mensagem`)
  }
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
