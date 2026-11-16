import type { MemoryAgent, ResumoFeito } from "@/core/agents/memory/memoria"
import { resumoPorCodigo } from "@/core/agents/memory/resumo"
import type { Stores } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"
import type { NotaDeRotina } from "./ports"

export type ResumoAtualizado = {
  origem: "vazio" | "direto" | "modelo" | "codigo"
  gravou: boolean
  modelo?: string
  tokens: { entrada: number; saida: number }
  duracao_ms: number
}

type Deps = { stores: Stores; memory: MemoryAgent; telemetry: Telemetry }
type Feito = Pick<ResumoFeito, "texto" | "modelo" | "tokens"> & {
  origem: ResumoAtualizado["origem"]
  duracao_ms: number
}

const SEM_GASTO = { tokens: { entrada: 0, saida: 0 }, duracao_ms: 0 }

async function resumir(memory: MemoryAgent, notas: NotaDeRotina[]): Promise<Feito> {
  if (notas.length === 0) return { texto: "", origem: "vazio", ...SEM_GASTO }
  if (notas.length === 1) return { texto: resumoPorCodigo(notas), origem: "direto", ...SEM_GASTO }
  const { texto, origem, modelo, tokens, duracao_ms } = await memory.resumir(notas)
  return { texto, origem, modelo, tokens, duracao_ms }
}

export async function atualizarResumo(deps: Deps, contaId: string): Promise<ResumoAtualizado> {
  const { stores, memory, telemetry } = deps
  const notas = await stores.routine.notasAtivas(contaId)
  const { texto, ...feito } = await resumir(memory, notas)
  const atual = await stores.routine.resumo(contaId)
  const igual = atual === undefined ? texto === "" : atual.texto === texto
  if (igual) return { ...feito, gravou: false }
  await stores.routine.gravarResumo(contaId, texto)
  telemetry.contador("ritu_rotina_resumo_total", { origem: feito.origem })
  return { ...feito, gravou: true }
}
