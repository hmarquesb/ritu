import type { Clock } from "@/core/clock"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Estado } from "@/core/knowledge/vocab"
import type { LlmClient } from "@/core/llm/client"
import type { ModelRouter } from "@/core/llm/router"
import type { Retorno } from "@/core/outcomes/ports"
import type { Telemetry } from "@/core/telemetry/ports"
import { chamarApoio } from "../chamada-de-apoio"
import { interpreteV1 } from "../prompts/interprete.v1"
import { type MensagemNoPrompt, montarEntradaDoInterprete } from "./entrada"
import { type Interpretacao, normalizarInterpretacao } from "./interpretacao"
import { saidaDoInterpreteSchema } from "./saida"

export type ResultadoDoInterprete =
  | {
      ok: true
      interpretacao: Interpretacao
      modelo: string
      tokens: { entrada: number; saida: number }
      trocas: number
      duracao_ms: number
    }
  | { ok: false; motivo: "sem_modelo" | "erro"; duracao_ms: number }

type Deps = {
  router: ModelRouter
  client: LlmClient
  kb: KnowledgeBase
  telemetry: Telemetry
  clock: Clock
}

type Pedido = {
  texto: string
  atalhos: Estado[]
  conversa: MensagemNoPrompt[]
  pendentes: Retorno[]
}

export function createInterpreter(deps: Deps) {
  const { router, client, kb, telemetry, clock } = deps

  return {
    interpretar(p: Pedido): Promise<ResultadoDoInterprete> {
      return telemetry.span("interprete", {}, async (span) => {
        const inicio = clock.now().getTime()
        const duracao = () => clock.now().getTime() - inicio
        const r = await chamarApoio({ router, client, telemetry, clock }, span, {
          instrucoes: interpreteV1.instrucoes,
          entrada: montarEntradaDoInterprete({ ...p, kb }),
          schema: saidaDoInterpreteSchema,
        })
        if (!r.ok) return { ok: false, motivo: r.motivo, duracao_ms: duracao() }
        const interpretacao = normalizarInterpretacao(r.dado, {
          atalhos: p.atalhos,
          pendentes: p.pendentes,
          kb,
        })
        return {
          ok: true,
          interpretacao,
          modelo: r.modelo,
          tokens: r.tokens,
          trocas: r.trocas,
          duracao_ms: duracao(),
        }
      })
    },
  }
}
