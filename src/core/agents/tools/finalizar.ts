import { z } from "zod"
import { type DadosDoPreparo, dadosDoPreparoSchema } from "@/core/agents/companion/preparo"
import {
  completarSaida,
  type EntregaDoModelo,
  entregaDoModeloSchema,
} from "@/core/agents/companion/saida"
import { validarEntrega } from "@/core/agents/companion/validador"
import { gunaSchema } from "@/core/knowledge/vocab"
import { propostasDoAgente } from "@/core/proposals/montar"
import type { ToolDeControle } from "@/core/runs/agente"
import type { Checkpoint } from "@/core/runs/checkpoint"

const climaOkSchema = z.object({ status: z.literal("ok"), gunas: z.array(gunaSchema) })

// D6: o último resultado ok de clima.agora guardado nas mensagens do loop.
function climaDoRun(estado: Checkpoint): { gunas: z.infer<typeof gunaSchema>[] } | undefined {
  for (let i = estado.mensagens.length - 1; i >= 0; i--) {
    const m = estado.mensagens[i]
    if (m?.papel !== "tool" || m.nome !== "clima.agora") continue
    const lido = climaOkSchema.safeParse(m.resultado)
    if (lido.success) return { gunas: lido.data.gunas }
  }
  return undefined
}

/** Resumo da etapa `validacao`: `ok` ou os códigos das violações, únicos, na ordem. */
export function resumoDaValidacao(violacoes: { codigo: string }[]): string {
  if (violacoes.length === 0) return "ok"
  return [...new Set(violacoes.map((v) => v.codigo))].join(",")
}

export const finalizar: ToolDeControle<EntregaDoModelo> = {
  name: "finalizar",
  description:
    "Entrega a resposta à pessoa. Confere a resposta antes: se devolver violações, corrija e chame de novo.",
  input: entregaDoModeloSchema,
  async tratar(entrada, ctx, estado) {
    const dados: DadosDoPreparo = dadosDoPreparoSchema.parse(estado.dados)
    const clima = climaDoRun(estado)
    const violacoes = await ctx.telemetry.span(
      "validacao",
      { "validacao.tentativa": estado.entregas_recusadas + 1 },
      async (s) => {
        const v = validarEntrega(entrada, {
          dados,
          ...(clima ? { clima } : {}),
          kb: ctx.kb,
          sinais: ctx.sinais,
        })
        s.atribuir({ "validacao.ok": v.length === 0, "validacao.violacoes": v.length })
        return v
      },
    )
    if (violacoes.length > 0) {
      for (const v of violacoes) {
        ctx.telemetry.contador("ritu_validacao_violacoes_total", { violacao: v.codigo })
      }
      return {
        tipo: "recusar",
        resultado: { entregue: false, violacoes },
        resumo: resumoDaValidacao(violacoes),
      }
    }
    const propostas = propostasDoAgente(estado.mensagens)
    const saida = completarSaida(entrada, dados, ctx.kb)
    return {
      tipo: "entregar",
      resumo: resumoDaValidacao([]),
      saida: propostas.length > 0 ? { ...saida, propostas_do_agente: propostas } : saida,
    }
  },
}
