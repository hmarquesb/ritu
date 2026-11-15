import type { z } from "zod"
import type { Clock } from "@/core/clock"
import type { Prakriti } from "@/core/knowledge/adequacao"
import type { FiltroPessoa } from "@/core/knowledge/filtros"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { SinaisPessoa } from "@/core/knowledge/substitutos"
import type { Stores } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"
import type { CidadeDaPessoa, WeatherSource } from "@/core/weather/ports"

export type ToolContext = {
  kb: KnowledgeBase
  filtro: FiltroPessoa
  sinais: SinaisPessoa
  prakriti?: Prakriti
  clima: { fonte: WeatherSource; cidade?: CidadeDaPessoa }
  contaId: string
  stores: Pick<Stores, "pantry" | "preferences" | "runs" | "outcomes">
  clock: Clock
  fuso?: string
  telemetry: Telemetry
}

export type Tool<I, O> = {
  name: string
  description: string
  input: z.ZodType<I>
  output: z.ZodType<O>
  /** Até 80 caracteres, sem dado da pessoa. */
  resumir?(saida: O): string
  execute(input: I, ctx: ToolContext): Promise<O>
}

// Valida entrada e saída com zod em volta da lógica da tool (síncrona ou assíncrona).
export function definirTool<I, O>(def: {
  name: string
  description: string
  input: z.ZodType<I>
  output: z.ZodType<O>
  resumir?(saida: O): string
  executar: (entrada: I, ctx: ToolContext) => O | Promise<O>
}): Tool<I, O> {
  return {
    name: def.name,
    description: def.description,
    input: def.input,
    output: def.output,
    ...(def.resumir ? { resumir: def.resumir } : {}),
    async execute(entrada, ctx) {
      const dados = def.input.parse(entrada)
      return def.output.parse(await def.executar(dados, ctx))
    },
  }
}
