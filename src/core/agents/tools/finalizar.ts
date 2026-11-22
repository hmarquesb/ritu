import { z } from "zod"
import { completarEntrega, emTermosDaEscolha } from "@/core/agents/companion/completar"
import { type DadosDoPreparo, dadosDoPreparoSchema } from "@/core/agents/companion/preparo"
import type { EntregaDoModelo } from "@/core/agents/companion/saida"
import {
  completarSaida,
  type EscolhaDoModelo,
  escolhaDoModeloSchema,
} from "@/core/agents/companion/saida"
import { type Violacao, validarEntrega } from "@/core/agents/companion/validador"
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

type Conferida =
  | { tipo: "ok"; entrega: EntregaDoModelo }
  | { tipo: "montagem"; violacoes: Violacao[] }
  | { tipo: "modelo"; violacoes: Violacao[] }

export const finalizar: ToolDeControle<EscolhaDoModelo> = {
  name: "finalizar",
  description:
    "Entrega a resposta à pessoa. Confere a escolha antes: se devolver violações, corrija e chame de novo.",
  input: escolhaDoModeloSchema,
  async tratar(escolha, ctx, estado) {
    const dados: DadosDoPreparo = dadosDoPreparoSchema.parse(estado.dados)
    const clima = climaDoRun(estado)
    const contexto = { dados, ...(clima ? { clima } : {}), kb: ctx.kb }
    const conferida = await ctx.telemetry.span(
      "validacao",
      { "validacao.tentativa": estado.entregas_recusadas + 1 },
      async (s): Promise<Conferida> => {
        const m = completarEntrega(escolha, contexto)
        const v = m.ok
          ? validarEntrega(m.entrega, { ...contexto, sinais: ctx.sinais })
          : m.violacoes
        s.atribuir({ "validacao.ok": v.length === 0, "validacao.violacoes": v.length })
        for (const x of v) {
          ctx.telemetry.contador("ritu_validacao_violacoes_total", { violacao: x.codigo })
        }
        if (v.some((x) => x.origem === "montagem")) return { tipo: "montagem", violacoes: v }
        if (!m.ok) return { tipo: "modelo", violacoes: v }
        if (v.length > 0) {
          return { tipo: "modelo", violacoes: emTermosDaEscolha(v, escolha, m.entrega) }
        }
        return { tipo: "ok", entrega: m.entrega }
      },
    )
    if (conferida.tipo === "montagem") {
      return { tipo: "encerrar", codigo: "montagem", resumo: "erro_de_montagem" }
    }
    if (conferida.tipo === "modelo") {
      const { violacoes } = conferida
      return {
        tipo: "recusar",
        resultado: { entregue: false, violacoes },
        resumo: resumoDaValidacao(violacoes),
      }
    }
    const propostas = propostasDoAgente(estado.mensagens)
    const saida = completarSaida(conferida.entrega, dados, ctx.kb)
    return {
      tipo: "entregar",
      resumo: resumoDaValidacao([]),
      saida: propostas.length > 0 ? { ...saida, propostas_do_agente: propostas } : saida,
    }
  },
}
