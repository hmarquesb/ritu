import { z } from "zod"
import { RituError } from "@/core/errors"
import type { MensagemDoLoop } from "./agent-runtime"

const chamadaSchema = z.object({
  id: z.string(),
  nome: z.string(),
  argumentos: z.unknown(),
})

const mensagemSchema = z.discriminatedUnion("papel", [
  z.object({ papel: z.literal("pessoa"), conteudo: z.string() }),
  z.object({
    papel: z.literal("agente"),
    texto: z.string().optional(),
    chamadas: z.array(chamadaSchema),
  }),
  z.object({
    papel: z.literal("tool"),
    chamada_id: z.string(),
    nome: z.string(),
    resultado: z.unknown(),
  }),
  z.object({ papel: z.literal("sistema"), conteudo: z.string() }),
])

const contagem = z.number().int().nonnegative()

export const pendenciaSchema = z.object({
  tipo: z.enum(["pergunta", "aprovacao"]),
  chamada_id: z.string().optional(),
  conteudo: z.unknown(),
  criada_em: z.string(),
})

export const checkpointSchema = z.object({
  versao: z.literal(1),
  agente: z.string(),
  prompt_versao: z.string(),
  mensagens: z.array(mensagemSchema),
  chamadas_de_modelo: contagem,
  tokens: z.object({ entrada: contagem, saida: contagem }),
  entregas_recusadas: contagem,
  pausas: contagem,
  ativo_ms: z.number().nonnegative(),
  modelo: z.string().optional(),
  dados: z.unknown(),
})

export type Checkpoint = {
  versao: 1
  agente: string
  prompt_versao: string
  mensagens: MensagemDoLoop[]
  chamadas_de_modelo: number
  tokens: { entrada: number; saida: number }
  entregas_recusadas: number
  pausas: number
  /** Tempo de trabalho já gasto em trechos anteriores. */
  ativo_ms: number
  /** O run tenta manter o mesmo modelo. */
  modelo?: string
  /** Contexto do preparo; quem define o formato é a 007. */
  dados: unknown
}

export function lerCheckpoint(json: unknown): Checkpoint {
  const lido = checkpointSchema.safeParse(json)
  if (!lido.success) throw new RituError("checkpoint_invalido", "Checkpoint inválido")
  return lido.data as Checkpoint
}
