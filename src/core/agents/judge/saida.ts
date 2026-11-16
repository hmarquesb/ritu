import { juiz } from "@config/juiz"
import { z } from "zod"

export type MotivoDoJuiz =
  | "promessa"
  | "dosagem"
  | "conselho"
  | "evitar_sempre"
  | "texto_diferente"
  | "motivo_sem_base"
  | "para_ter"
  | "vulgar"
  | "tom"
  | "jargao"
  | "saude_na_proposta"

export const MOTIVOS_DO_JUIZ: readonly MotivoDoJuiz[] = [
  "promessa",
  "dosagem",
  "conselho",
  "evitar_sempre",
  "texto_diferente",
  "motivo_sem_base",
  "para_ter",
  "vulgar",
  "tom",
  "jargao",
  "saude_na_proposta",
]

export type Apontamento = { motivo: MotivoDoJuiz; trecho: string }

export const saidaDoJuizSchema = z
  .object({
    apontamentos: z.array(z.object({ motivo: z.string(), trecho: z.string() })),
  })
  .strict()

function ehMotivo(motivo: string): motivo is MotivoDoJuiz {
  return (MOTIVOS_DO_JUIZ as readonly string[]).includes(motivo)
}

function cortarTrecho(trecho: string): string {
  return Array.from(trecho).slice(0, juiz.maxTrecho).join("")
}

export function lerApontamentos(dado: z.infer<typeof saidaDoJuizSchema>): Apontamento[] {
  const lidos: Apontamento[] = []
  for (const apontamento of dado.apontamentos) {
    if (ehMotivo(apontamento.motivo)) {
      lidos.push({ motivo: apontamento.motivo, trecho: cortarTrecho(apontamento.trecho) })
    }
  }
  return lidos
}
