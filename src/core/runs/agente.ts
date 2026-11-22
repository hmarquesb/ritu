import type { z } from "zod"
import type { Tool, ToolContext } from "@/core/tools/tool"
import type { Checkpoint } from "./checkpoint"

export type Pendencia = {
  tipo: "pergunta" | "aprovacao"
  chamada_id?: string
  conteudo: unknown
  criada_em: string
}

export type ResultadoDeControle =
  | { tipo: "entregar"; saida: unknown; resumo?: string }
  | { tipo: "recusar"; resultado: unknown; resumo?: string } // volta ao modelo como resultado da tool
  | { tipo: "encerrar"; codigo: string; resumo?: string } // fecha o run com erro, sem voltar ao modelo
  | { tipo: "pausar"; pendencia: Omit<Pendencia, "criada_em" | "chamada_id">; resumo?: string }

export type ToolDeControle<I> = {
  name: string
  description: string
  input: z.ZodType<I>
  tratar(input: I, ctx: ToolContext, estado: Checkpoint): Promise<ResultadoDeControle>
  /** Transforma a resposta da pessoa no resultado da tool. */
  aoRetomar?(resposta: unknown, estado: Checkpoint): unknown
}

export type DefinicaoDoAgente = {
  nome: string
  instrucoes: string
  prompt_versao: string
  tools: Tool<unknown, unknown>[]
  /** Pelo menos uma tool que entrega. */
  controle: ToolDeControle<unknown>[]
  lembreteDeEntrega: string
}
