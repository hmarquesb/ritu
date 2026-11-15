import type { z } from "zod"
import type { LlmClient } from "@/core/llm/client"
import { LlmError } from "@/core/llm/errors"

type RespostaRoteirizada = unknown | { erro: LlmError["code"] }

type PedidoRegistrado = { modelo: string; instrucoes: string; entrada: string }

const TOKENS_FIXOS = { entrada: 10, saida: 5 }

function ehErroRoteirizado(r: RespostaRoteirizada): r is { erro: LlmError["code"] } {
  return typeof r === "object" && r !== null && "erro" in r
}

/** LlmClient falso: consome respostas roteirizadas, em ordem, e registra cada pedido. */
export function createFakeLlm(
  respostas: RespostaRoteirizada[],
): LlmClient & { pedidos: unknown[] } {
  const fila = [...respostas]
  const pedidos: PedidoRegistrado[] = []

  return {
    pedidos,
    async gerar<T>(p: {
      modelo: string
      instrucoes: string
      entrada: string
      schema: z.ZodType<T>
      timeoutMs?: number
    }) {
      pedidos.push({ modelo: p.modelo, instrucoes: p.instrucoes, entrada: p.entrada })

      if (fila.length === 0) {
        throw new Error("fake-llm: acabaram as respostas roteirizadas")
      }
      const resposta = fila.shift()

      if (ehErroRoteirizado(resposta)) {
        throw new LlmError(resposta.erro, `fake-llm: erro roteirizado ${resposta.erro}`)
      }

      const validado = p.schema.safeParse(resposta)
      if (!validado.success) {
        throw new LlmError("resposta_invalida", "fake-llm: resposta fora do schema")
      }

      return { dado: validado.data, tokens: { ...TOKENS_FIXOS } }
    },
  }
}
