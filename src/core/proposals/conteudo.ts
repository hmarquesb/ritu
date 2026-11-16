import { z } from "zod"
import type { EvitarItem } from "@/core/knowledge/filtros"
import { type Restricao, restricaoSchema } from "@/core/knowledge/vocab"

export type TipoDeProposta = "casa.propor" | "memoria.propor" | "lista.propor" | "padrao.confirmar"

export type ConteudoDaProposta =
  | { tool: "casa.propor"; acao: "tem" | "acabou"; itens: { alimento_id?: string; nome: string }[] }
  | { tool: "memoria.propor"; tipo: "evitar_sempre"; itens: EvitarItem[] }
  | { tool: "memoria.propor"; tipo: "restricao"; itens: Restricao[] }
  | { tool: "memoria.propor"; tipo: "nao_come"; itens: { alimento_id?: string; nome: string }[] }
  | { tool: "memoria.propor"; tipo: "gosta"; itens: { alimento_id: string; nome: string }[] }
  | { tool: "memoria.propor"; tipo: "rotina"; texto: string } // até 200
  | {
      tool: "lista.propor"
      alimento_id: string
      motivo: "faltou_hoje" | "fez_falta"
      detalhe: string
    }
  | { tool: "padrao.confirmar"; padrao_id: string; frase: string } // frase até 200

export type PropostaNaSaida = { id: string; tool: TipoDeProposta; texto: string }

const naoVazio = z.string().min(1)

const itemDeCasaSchema = z.strictObject({ alimento_id: naoVazio.optional(), nome: naoVazio })
const evitarItemSchema = z.strictObject({
  tipo: z.enum(["grupo", "alimento", "texto"]),
  valor: naoVazio,
})
const gostaItemSchema = z.strictObject({ alimento_id: naoVazio, nome: naoVazio })

const casaSchema = z.strictObject({
  tool: z.literal("casa.propor"),
  acao: z.enum(["tem", "acabou"]),
  itens: z.array(itemDeCasaSchema).min(1),
})
const evitarSempreSchema = z.strictObject({
  tool: z.literal("memoria.propor"),
  tipo: z.literal("evitar_sempre"),
  itens: z.array(evitarItemSchema).min(1),
})
const restricaoPropostaSchema = z.strictObject({
  tool: z.literal("memoria.propor"),
  tipo: z.literal("restricao"),
  itens: z.array(restricaoSchema).min(1),
})
const naoComePropostaSchema = z.strictObject({
  tool: z.literal("memoria.propor"),
  tipo: z.literal("nao_come"),
  itens: z.array(itemDeCasaSchema).min(1),
})
const gostaPropostaSchema = z.strictObject({
  tool: z.literal("memoria.propor"),
  tipo: z.literal("gosta"),
  itens: z.array(gostaItemSchema).min(1),
})
const rotinaSchema = z.strictObject({
  tool: z.literal("memoria.propor"),
  tipo: z.literal("rotina"),
  texto: z.string().min(1).max(200),
})
const padraoSchema = z.strictObject({
  tool: z.literal("padrao.confirmar"),
  padrao_id: naoVazio,
  frase: z.string().min(1).max(200),
})
const listaSchema = z.strictObject({
  tool: z.literal("lista.propor"),
  alimento_id: naoVazio,
  motivo: z.enum(["faltou_hoje", "fez_falta"]),
  detalhe: naoVazio,
})

export const conteudoDaPropostaSchema: z.ZodType<ConteudoDaProposta> = z.union([
  casaSchema,
  evitarSempreSchema,
  restricaoPropostaSchema,
  naoComePropostaSchema,
  gostaPropostaSchema,
  rotinaSchema,
  listaSchema,
  padraoSchema,
])

export const propostaNaSaidaSchema = z.object({
  id: z.string(),
  tool: z.enum(["casa.propor", "memoria.propor", "lista.propor", "padrao.confirmar"]),
  texto: z.string(),
})

/** O que vai para `propostas.conteudo`: o objeto sem o campo `tool`, que vai na coluna. */
export function semTool(c: ConteudoDaProposta): {
  tool: TipoDeProposta
  conteudo: Record<string, unknown>
} {
  const { tool, ...conteudo } = c
  return { tool, conteudo }
}

/** Junta coluna e conteúdo e valida; undefined se não passar no schema. */
export function lerConteudo(tool: string, conteudo: unknown): ConteudoDaProposta | undefined {
  if (typeof conteudo !== "object" || conteudo === null || Array.isArray(conteudo)) return undefined
  const r = conteudoDaPropostaSchema.safeParse({ ...conteudo, tool })
  return r.success ? r.data : undefined
}
