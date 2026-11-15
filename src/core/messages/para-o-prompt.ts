import { config } from "@config/index"
import type { Caminho } from "@/core/runs/ports"
import type { Stores } from "@/core/stores"
import type { Mensagem } from "./ports"

const JANELA_DE_RUNS_MS = 36 * 60 * 60 * 1000
const LIMITE_DE_RUNS = 50
const CAMINHOS_FORA: readonly Caminho[] = config.conversa.caminhosForaDoPrompt

export type MensagemNoPrompt = { autor: "pessoa" | "agente"; texto: string }

type RunDoPrompt = { id: string; caminho: Caminho }

// Tira a run atual e as runs de caminho fora do prompt; devolve as últimas `limite`, em ordem.
export function mensagensParaOPrompt(p: {
  mensagens: Mensagem[]
  runs: RunDoPrompt[]
  runAtualId: string
  limite: number
}): MensagemNoPrompt[] {
  const foraDoPrompt = new Set(
    p.runs.filter((r) => CAMINHOS_FORA.includes(r.caminho)).map((r) => r.id),
  )
  const visiveis = p.mensagens.filter(
    (m) => m.run_id === null || (m.run_id !== p.runAtualId && !foraDoPrompt.has(m.run_id)),
  )
  return visiveis
    .slice(Math.max(0, visiveis.length - p.limite))
    .map((m) => ({ autor: m.autor, texto: m.texto }))
}

// Lê a conversa do dia da conta e aplica a exclusão. Só runs do dia entram na lista de exclusão (D13).
export async function lerConversaDoDia(
  stores: Pick<Stores, "messages" | "runs">,
  p: { contaId: string; dia: string; agora: Date; runAtualId: string; limite: number },
): Promise<MensagemNoPrompt[]> {
  const [mensagens, recentes] = await Promise.all([
    stores.messages.doDia(p.contaId, p.dia),
    stores.runs.recentes(
      p.contaId,
      new Date(p.agora.getTime() - JANELA_DE_RUNS_MS),
      LIMITE_DE_RUNS,
    ),
  ])
  const runs = recentes
    .filter((r) => r.dia === p.dia)
    .map((r) => ({ id: r.id, caminho: r.caminho }))
  return mensagensParaOPrompt({ mensagens, runs, runAtualId: p.runAtualId, limite: p.limite })
}
