import type { MemoryAgent } from "@/core/agents/memory/memoria"
import { RituError } from "@/core/errors"
import { contemIncomodo } from "@/core/knowledge/incomodo-no-texto"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Stores, Transactor } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"
import type { NotaDeRotina } from "./ports"
import { atualizarResumo } from "./resumo"

type Deps = {
  stores: Stores
  tx: Transactor
  memory: MemoryAgent
  kb: KnowledgeBase
  telemetry: Telemetry
}

const TEXTO_MAX = 200

function invalida(): RituError {
  return new RituError("nota_invalida", "Nota inválida")
}

async function notaAtiva(stores: Stores, contaId: string, notaId: string): Promise<NotaDeRotina> {
  const nota = (await stores.routine.notasAtivas(contaId)).find((n) => n.id === notaId)
  if (!nota) throw invalida()
  return nota
}

function textoDaNota(texto: string, kb: KnowledgeBase): string {
  const limpo = texto.trim()
  if (limpo === "" || limpo.length > TEXTO_MAX || contemIncomodo(limpo, kb)) throw invalida()
  return limpo
}

export async function apagarNota(deps: Deps, contaId: string, notaId: string): Promise<void> {
  const { stores, memory, telemetry } = deps
  await notaAtiva(stores, contaId, notaId)
  await stores.routine.desativar(contaId, notaId)
  await atualizarResumo({ stores, memory, telemetry }, contaId)
}

export async function corrigirNota(
  deps: Deps,
  contaId: string,
  notaId: string,
  texto: string,
): Promise<NotaDeRotina> {
  const { stores, tx, memory, telemetry } = deps
  const limpo = textoDaNota(texto, deps.kb)
  const nova = await tx.emTransacao(async (s) => {
    await notaAtiva(s, contaId, notaId)
    await s.routine.desativar(contaId, notaId)
    return s.routine.anotar(contaId, limpo)
  })
  await atualizarResumo({ stores, memory, telemetry }, contaId)
  return nova
}
