import type { Clock } from "@/core/clock"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { chamarComPapel } from "@/core/llm/chamar"
import type { LlmClient } from "@/core/llm/client"
import type { ModelRouter } from "@/core/llm/router"
import type { Telemetry } from "@/core/telemetry/ports"
import { memoriaV1 } from "../prompts/memoria.v1"
import { montarEntradaDaMemoria, type NotaParaResumo } from "./entrada"
import { resumoPorCodigo, validarResumo } from "./resumo"
import { saidaDaMemoriaSchema } from "./saida"

export type ResumoFeito = {
  texto: string
  origem: "modelo" | "codigo"
  modelo?: string
  tokens: { entrada: number; saida: number }
  trocas: number
  duracao_ms: number
}

export type MemoryAgent = { resumir(notas: NotaParaResumo[]): Promise<ResumoFeito> }

type Deps = {
  router: ModelRouter
  client: LlmClient
  kb: KnowledgeBase
  telemetry: Telemetry
  clock: Clock
}

type SemDuracao = Omit<ResumoFeito, "duracao_ms">

export function createMemoryAgent(deps: Deps): MemoryAgent {
  const { router, client, kb, telemetry, clock } = deps

  // Uma chamada do papel apoio; qualquer falha ou resumo inválido cai no resumo por código (D8).
  async function tentar(notas: NotaParaResumo[]): Promise<SemDuracao> {
    const porCodigo: SemDuracao = {
      texto: resumoPorCodigo(notas),
      origem: "codigo",
      tokens: { entrada: 0, saida: 0 },
      trocas: 0,
    }
    try {
      const r = await chamarComPapel(
        { router, client, telemetry },
        {
          papel: "apoio",
          instrucoes: memoriaV1.instrucoes,
          entrada: montarEntradaDaMemoria(notas),
          schema: saidaDaMemoriaSchema,
        },
      )
      const gasto = { modelo: r.modelo, tokens: r.tokens, trocas: r.trocas }
      const validado = validarResumo(r.dado.resumo, kb)
      if (validado === undefined) return { ...porCodigo, ...gasto }
      return { texto: validado, origem: "modelo", ...gasto }
    } catch {
      return porCodigo
    }
  }

  return {
    resumir(notas) {
      return telemetry.span("memoria.resumo", {}, async (span) => {
        const inicio = clock.now().getTime()
        const feito = await tentar(notas)
        span.atribuir({ "resumo.origem": feito.origem })
        return { ...feito, duracao_ms: clock.now().getTime() - inicio }
      })
    },
  }
}
