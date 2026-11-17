import type { Conta, Perfil } from "@/core/accounts/types"
import type { Clock } from "@/core/clock"
import type { DemoSeed } from "@/core/demo-seed"
import type { Mensagem } from "@/core/messages/ports"
import type { Run } from "@/core/runs/ports"
import type { Stores } from "@/core/stores"
import { diaLocal } from "@/core/time/dia-local"
import { type VisaoDoRun, visaoDoRun } from "./visao"

export type FalaNaTela =
  | { autor: "pessoa"; id: string; texto: string; run_id: string | null }
  | { autor: "agente"; id: string; texto: string; run_id: string | null }

export type ConversaDoDia = {
  falas: FalaNaTela[]
  runs: Record<string, VisaoDoRun>
  aberto?: { run_id: string; status: Run["status"] }
  pendentes: number
  mensagem_sugerida?: string
}

type Deps = { stores: Stores; clock: Clock; seed: DemoSeed }

// O que a tela recebe ao abrir: falas do dia, visão de cada run citado, o run aberto e os retornos pendentes.
export async function conversaDoDia(
  deps: Deps,
  conta: Conta,
  perfil: Perfil,
): Promise<ConversaDoDia> {
  const { stores, clock, seed } = deps
  const agora = clock.now()
  const dia = diaLocal(agora, perfil.cidade_fuso ?? undefined)
  const [mensagens, doDia, aberto, pendentes] = await Promise.all([
    stores.messages.doDia(conta.id, dia),
    stores.runs.doDia(conta.id, dia),
    stores.runs.aberto(conta.id),
    stores.outcomes.pendentes(conta.id),
  ])

  const conhecidos = new Map<string, Run>(doDia.map((r) => [r.id, r]))
  if (aberto) conhecidos.set(aberto.id, aberto)
  const ids = idsDosRuns(mensagens, aberto)
  const visoes = await visoesDos(stores, conta.id, ids, conhecidos, agora)

  const falas = mensagens
    .filter((m) => !ehTextoDaPergunta(m, visoes))
    .map((m): FalaNaTela => ({ autor: m.autor, id: m.id, texto: m.texto, run_id: m.run_id }))
  const sugerida = conta.tipo === "demo" && falas.length === 0 ? seed.mensagem_sugerida : undefined

  return {
    falas,
    runs: Object.fromEntries(visoes),
    pendentes: pendentes.length,
    ...(aberto ? { aberto: { run_id: aberto.id, status: aberto.status } } : {}),
    ...(sugerida !== undefined ? { mensagem_sugerida: sugerida } : {}),
  }
}

function idsDosRuns(mensagens: Mensagem[], aberto: Run | undefined): string[] {
  const dasFalas = mensagens.flatMap((m) => (m.run_id ? [m.run_id] : []))
  const doAberto = aberto ? [aberto.id] : []
  return [...new Set([...dasFalas, ...doAberto])]
}

async function visoesDos(
  stores: Stores,
  contaId: string,
  ids: string[],
  conhecidos: Map<string, Run>,
  agora: Date,
): Promise<Map<string, VisaoDoRun>> {
  const votos = await stores.runs.votos(contaId, ids)
  const entradas = await Promise.all(
    ids.map(async (id) => {
      const run = conhecidos.get(id) ?? (await stores.runs.buscar(contaId, id))
      if (!run) return undefined
      const voto = votos[id]
      const visao = await visaoDe(stores, contaId, run, voto, agora)
      return [id, visao] as const
    }),
  )
  return new Map(entradas.flatMap((e) => (e ? [e] : [])))
}

async function visaoDe(
  stores: Stores,
  contaId: string,
  run: Run,
  voto: "up" | "down" | undefined,
  agora: Date,
): Promise<VisaoDoRun> {
  const [etapas, propostas, retornos] = await Promise.all([
    stores.runs.etapas(contaId, run.id),
    stores.proposals.doRun(contaId, run.id),
    stores.outcomes.doRun(contaId, run.id),
  ])
  return visaoDoRun({
    run,
    etapas,
    propostas,
    retornos,
    agora,
    ...(voto ? { voto } : {}),
  })
}

// A pergunta do agente já aparece na visão do run; não vira fala solta.
function ehTextoDaPergunta(m: Mensagem, visoes: Map<string, VisaoDoRun>): boolean {
  if (m.autor !== "agente" || !m.run_id) return false
  const pergunta = visoes.get(m.run_id)?.pergunta
  return pergunta !== undefined && pergunta.pergunta.texto === m.texto
}
