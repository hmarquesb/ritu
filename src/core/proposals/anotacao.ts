import { z } from "zod"
import type { EvitarItem } from "@/core/knowledge/filtros"
import { type Restricao, restricaoSchema } from "@/core/knowledge/vocab"

// Anotações: o que a pessoa disse e que vira proposta de gravação (quem grava é o executor). Nenhum campo leva motivo.
export type Anotacao =
  | { tipo: "casa_tem"; itens: { alimento_id?: string; nome: string }[] }
  | { tipo: "casa_acabou"; itens: { alimento_id?: string; nome: string }[] }
  | { tipo: "evitar_sempre"; itens: EvitarItem[] }
  | { tipo: "nao_come"; itens: { alimento_id?: string; nome: string }[] }
  | { tipo: "gosta"; itens: { alimento_id: string; nome: string }[] }
  | { tipo: "restricao"; itens: Restricao[] }

const itemDeCasaSchema = z.object({ alimento_id: z.string().optional(), nome: z.string() })
const evitarItemSchema = z.object({
  tipo: z.enum(["grupo", "alimento", "texto"]),
  valor: z.string(),
})

export const anotacaoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("casa_tem"), itens: z.array(itemDeCasaSchema) }),
  z.object({ tipo: z.literal("casa_acabou"), itens: z.array(itemDeCasaSchema) }),
  z.object({ tipo: z.literal("evitar_sempre"), itens: z.array(evitarItemSchema) }),
  z.object({ tipo: z.literal("nao_come"), itens: z.array(itemDeCasaSchema) }),
  z.object({
    tipo: z.literal("gosta"),
    itens: z.array(z.object({ alimento_id: z.string(), nome: z.string() })),
  }),
  z.object({ tipo: z.literal("restricao"), itens: z.array(restricaoSchema) }),
])
