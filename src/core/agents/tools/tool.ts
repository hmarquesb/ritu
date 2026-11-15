import type { z } from "zod"
import type { Prakriti } from "@/core/knowledge/adequacao"
import type { FiltroPessoa } from "@/core/knowledge/filtros"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { SinaisPessoa } from "@/core/knowledge/substitutos"

export type ToolContext = {
  kb: KnowledgeBase
  filtro: FiltroPessoa
  sinais: SinaisPessoa
  prakriti?: Prakriti
}

export type Tool<I, O> = {
  name: string
  description: string
  input: z.ZodType<I>
  output: z.ZodType<O>
  execute(input: I, ctx: ToolContext): Promise<O>
}

// Valida entrada e saída com zod em volta da lógica pura da tool.
export function definirTool<I, O>(def: {
  name: string
  description: string
  input: z.ZodType<I>
  output: z.ZodType<O>
  executar: (entrada: I, ctx: ToolContext) => O
}): Tool<I, O> {
  return {
    name: def.name,
    description: def.description,
    input: def.input,
    output: def.output,
    async execute(entrada, ctx) {
      const dados = def.input.parse(entrada)
      return def.output.parse(def.executar(dados, ctx))
    },
  }
}
