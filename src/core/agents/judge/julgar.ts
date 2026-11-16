import { juiz as configDoJuiz } from "@config/juiz"
import type { z } from "zod"
import type { SaidaDoAcompanhante } from "@/core/agents/companion/saida"
import type { Clock } from "@/core/clock"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { LlmClient } from "@/core/llm/client"
import type { ModelRouter } from "@/core/llm/router"
import type { Telemetry } from "@/core/telemetry/ports"
import { chamarApoio } from "../chamada-de-apoio"
import { juizV1 } from "../prompts/juiz.v1"
import { montarEntradaDoJuiz } from "./entrada"
import { type Apontamento, lerApontamentos, type MotivoDoJuiz, saidaDoJuizSchema } from "./saida"

export type Veredito =
  | {
      ok: true
      aprovado: boolean
      graves: MotivoDoJuiz[]
      registros: MotivoDoJuiz[]
      saude_na_proposta: boolean
      apontamentos: Apontamento[]
      modelo: string
      tokens: { entrada: number; saida: number }
      trocas: number
      duracao_ms: number
    }
  | { ok: false; motivo: "sem_modelo" | "erro"; duracao_ms: number }

export type Judge = {
  julgar(p: {
    saida: SaidaDoAcompanhante
    evitar: string[]
    nota_de_rotina?: string
    tentativa: number
    preferir?: string
  }): Promise<Veredito>
}

type Deps = {
  router: ModelRouter
  client: LlmClient
  kb: KnowledgeBase
  telemetry: Telemetry
  clock: Clock
}

// Motivos distintos, na ordem do primeiro apontamento, que passam pelo filtro.
function motivosDe(
  apontamentos: Apontamento[],
  vale: (motivo: MotivoDoJuiz) => boolean,
): MotivoDoJuiz[] {
  const motivos: MotivoDoJuiz[] = []
  for (const { motivo } of apontamentos) {
    if (vale(motivo) && !motivos.includes(motivo)) motivos.push(motivo)
  }
  return motivos
}

function ehGrave(motivo: MotivoDoJuiz): boolean {
  return (configDoJuiz.graves as readonly string[]).includes(motivo)
}

function ehRegistro(motivo: MotivoDoJuiz): boolean {
  return (
    motivo === "saude_na_proposta" || (configDoJuiz.registros as readonly string[]).includes(motivo)
  )
}

function contar(telemetry: Telemetry, graves: MotivoDoJuiz[], registros: MotivoDoJuiz[]): void {
  for (const motivo of graves) telemetry.contador("ritu_juiz_reprovacoes_total", { motivo })
  for (const motivo of registros) telemetry.contador("ritu_juiz_avisos_total", { motivo })
}

// Apontamentos válidos e os motivos que reprovam ou só registram; sem nota, saude_na_proposta não conta.
function avaliar(dado: z.infer<typeof saidaDoJuizSchema>, nota?: string) {
  const lidos = lerApontamentos(dado)
  const apontamentos =
    nota === undefined ? lidos.filter((a) => a.motivo !== "saude_na_proposta") : lidos
  const graves = motivosDe(apontamentos, ehGrave)
  const registros = motivosDe(apontamentos, ehRegistro)
  return { apontamentos, graves, registros, aprovado: graves.length === 0 }
}

export function createJudge(deps: Deps): Judge {
  const { router, client, kb, telemetry, clock } = deps

  return {
    julgar(p) {
      return telemetry.span("juiz", { "juiz.tentativa": p.tentativa }, async (span) => {
        const inicio = clock.now().getTime()
        const duracao = () => clock.now().getTime() - inicio
        const r = await chamarApoio({ router, client, telemetry, clock }, span, {
          instrucoes: juizV1.instrucoes,
          entrada: montarEntradaDoJuiz({
            saida: p.saida,
            evitar: p.evitar,
            nota_de_rotina: p.nota_de_rotina,
            kb,
          }),
          schema: saidaDoJuizSchema,
          preferir: p.preferir,
        })
        if (!r.ok) return { ok: false, motivo: r.motivo, duracao_ms: duracao() }
        const { apontamentos, graves, registros, aprovado } = avaliar(r.dado, p.nota_de_rotina)
        contar(telemetry, graves, registros)
        span.atribuir({ "juiz.aprovado": aprovado })
        return {
          ok: true,
          aprovado,
          graves,
          registros,
          saude_na_proposta: apontamentos.some((a) => a.motivo === "saude_na_proposta"),
          apontamentos,
          modelo: r.modelo,
          tokens: r.tokens,
          trocas: r.trocas,
          duracao_ms: duracao(),
        }
      })
    },
  }
}
