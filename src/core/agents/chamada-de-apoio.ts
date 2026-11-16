import type { z } from "zod"
import { chamarComPapel, SemModeloError } from "@/core/llm/chamar"
import type { LlmClient } from "@/core/llm/client"
import { LlmError } from "@/core/llm/errors"
import type { ModelRouter } from "@/core/llm/router"
import type { SpanAtivo, Telemetry } from "@/core/telemetry/ports"

type Deps = { router: ModelRouter; client: LlmClient; telemetry: Telemetry }

type Pedido<T> = {
  instrucoes: string
  entrada: string
  schema: z.ZodType<T>
  preferir?: string
}

export type ResultadoDeApoio<T> =
  | {
      ok: true
      dado: T
      modelo: string
      tokens: { entrada: number; saida: number }
      trocas: number
    }
  | { ok: false; motivo: "sem_modelo" | "erro" }

/** Chamada ao papel apoio (Intérprete e Juiz): erro do modelo vira ok false e falha o span. */
export async function chamarApoio<T>(
  deps: Deps,
  span: SpanAtivo,
  pedido: Pedido<T>,
): Promise<ResultadoDeApoio<T>> {
  try {
    const r = await chamarComPapel(deps, { papel: "apoio", ...pedido })
    return { ok: true, dado: r.dado, modelo: r.modelo, tokens: r.tokens, trocas: r.trocas }
  } catch (e) {
    if (!(e instanceof SemModeloError) && !(e instanceof LlmError)) throw e
    const motivo = e instanceof SemModeloError ? "sem_modelo" : "erro"
    span.falhar(motivo)
    return { ok: false, motivo }
  }
}
