import {
  type AgentRuntime,
  type CodigoLlm,
  LlmError,
  type PedidoDePasso,
  type ResultadoDePasso,
} from "@/core/runs/agent-runtime"
import type { createFixedClock } from "./fixed-clock"

type FixedClock = ReturnType<typeof createFixedClock>

export type PassoRoteirizado = {
  chamadas?: { nome: string; argumentos: unknown }[]
  texto?: string
  tokens?: { entrada: number; saida: number }
  erro?: CodigoLlm
  demoraMs?: number
}

const TOKENS_PADRAO = { entrada: 100, saida: 20 }

/** Runtime de teste: cada passo consome o próximo item do roteiro, na ordem. */
export function createScriptedRuntime(
  roteiro: PassoRoteirizado[],
  clock?: FixedClock,
): AgentRuntime & { pedidos: PedidoDePasso[] } {
  const pedidos: PedidoDePasso[] = []
  let proximoIndice = 0
  let contadorDeChamadas = 0

  return {
    pedidos,
    async passo(pedido: PedidoDePasso): Promise<ResultadoDePasso> {
      pedidos.push(pedido)

      const passo = roteiro[proximoIndice]
      if (!passo) throw new Error("roteiro esgotado")
      proximoIndice += 1

      if (passo.demoraMs !== undefined && clock) clock.advance(passo.demoraMs)
      if (passo.erro) throw new LlmError(passo.erro, `falha simulada: ${passo.erro}`)

      const tokens = passo.tokens ?? TOKENS_PADRAO
      return {
        texto: passo.texto,
        chamadas: (passo.chamadas ?? []).map((chamada) => {
          contadorDeChamadas += 1
          return {
            id: `c${contadorDeChamadas}`,
            nome: chamada.nome,
            argumentos: chamada.argumentos,
          }
        }),
        tokens_entrada: tokens.entrada,
        tokens_saida: tokens.saida,
      }
    },
  }
}
