import { juiz as configDoJuiz } from "@config/juiz"
import { describe, expect, it } from "vitest"
import { saidaSegura } from "@/core/agents/companion/saida"
import { createJudge } from "@/core/agents/judge/julgar"
import { createModelRouter } from "@/core/llm/router"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { cenariosDeGuardrails, montarCenario } from "../../../test/fixtures/cenarios"
import {
  entregaDoCha,
  passoDoClima,
  RESPOSTA_DE_CONFORTO,
} from "../../../test/fixtures/cenarios/juiz-corrige"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

const AGORA = "2026-06-01T20:00:10Z"

function cenario(nome: string): CenarioDeConversa {
  const c = cenariosDeGuardrails[nome]
  if (!c) throw new Error(`cenário de guardrail ausente: ${nome}`)
  return c
}
const TRECHO = "trecho de teste"

// Juiz real (createJudge) sobre um cliente roteirizado; o aprovado é o que o código calcula.
function juizCom(respostas: unknown[]) {
  const clock = createFixedClock(AGORA)
  const telemetry = createMemoryTelemetry()
  const ledger = createMemoryLedger(clock)
  const router = createModelRouter({ ledger, clock, telemetry })
  const client = createFakeLlm(respostas)
  const judge = createJudge({ router, client, kb: createMiniKnowledge(), telemetry, clock })
  return { judge, telemetry }
}

const pedido = { saida: saidaSegura(), evitar: [], tentativa: 1 }
const ap = (motivo: string) => ({ motivo, trecho: TRECHO })

function metricasDoJuiz(telemetry: ReturnType<typeof createMemoryTelemetry>) {
  return telemetry.metricas.filter((m) => m.nome.startsWith("ritu_juiz_"))
}

describe("aprovado é calculado pelo código: um grave reprova", () => {
  it.each(configDoJuiz.graves)("%s reprova", async (motivo) => {
    const { judge } = juizCom([{ apontamentos: [ap(motivo)] }])
    const v = await judge.julgar(pedido)
    expect(v).toMatchObject({ ok: true, aprovado: false, graves: [motivo] })
  })

  it("só jargao aprova: é o único registro, e não reprova", async () => {
    const { judge } = juizCom([{ apontamentos: [ap("jargao")] }])
    const v = await judge.julgar(pedido)
    expect(v).toMatchObject({ ok: true, aprovado: true, graves: [], registros: ["jargao"] })
  })

  it("um grave junto de um registro reprova", async () => {
    const { judge } = juizCom([{ apontamentos: [ap("jargao"), ap("tom")] }])
    const v = await judge.julgar(pedido)
    expect(v).toMatchObject({ ok: true, aprovado: false, graves: ["tom"], registros: ["jargao"] })
  })
})

describe("motivo desconhecido é descartado", () => {
  it("sozinho, aprova e não soma métrica", async () => {
    const { judge, telemetry } = juizCom([{ apontamentos: [ap("inventado")] }])
    const v = await judge.julgar(pedido)
    expect(v).toMatchObject({
      ok: true,
      aprovado: true,
      graves: [],
      registros: [],
      apontamentos: [],
    })
    expect(metricasDoJuiz(telemetry)).toEqual([])
  })

  it("junto de um grave, não entra e não muda o veredito", async () => {
    const { judge } = juizCom([{ apontamentos: [ap("inventado"), ap("promessa")] }])
    const v = await judge.julgar(pedido)
    expect(v).toMatchObject({ ok: true, aprovado: false, graves: ["promessa"] })
    expect(v.ok && v.apontamentos.map((a) => a.motivo)).toEqual(["promessa"])
  })
})

describe("jargao: aviso, sem reprovar", () => {
  it("soma ritu_juiz_avisos_total com motivo jargao e nenhuma reprovação", async () => {
    const { judge, telemetry } = juizCom([{ apontamentos: [ap("jargao")] }])
    await judge.julgar(pedido)
    expect(metricasDoJuiz(telemetry)).toMatchObject([
      { nome: "ritu_juiz_avisos_total", rotulos: { motivo: "jargao" } },
    ])
  })

  it("aparece no resumo da etapa juiz do run, sem barrar a entrega", async () => {
    const c = {
      ...cenario("juiz-corrige"),
      juiz: [{ apontamentos: [{ motivo: "jargao", trecho: TRECHO }] }],
      roteiro: [passoDoClima, entregaDoCha(RESPOSTA_DE_CONFORTO)],
    }
    const { contaId, deps } = await montarCenario(c)
    const resposta = await deps.conversation.conversar(contaId, c.mensagem)
    const etapas = await deps.stores.runs.etapas(contaId, resposta.run_id)

    expect(resposta.saida?.origem).toBe("agente")
    expect(resposta.saida?.resposta).toBe(RESPOSTA_DE_CONFORTO)
    expect(etapas.filter((e) => e.tipo === "juiz").map((e) => [e.status, e.resumo])).toEqual([
      ["ok", "aprovado; registros: jargao"],
    ])
  })
})

describe("motivo repetido soma uma vez", () => {
  it("dois jargao: um aviso na métrica e um registro", async () => {
    const { judge, telemetry } = juizCom([{ apontamentos: [ap("jargao"), ap("jargao")] }])
    const v = await judge.julgar(pedido)
    expect(v).toMatchObject({ ok: true, aprovado: true, registros: ["jargao"] })
    expect(metricasDoJuiz(telemetry)).toHaveLength(1)
  })

  it("dois tom: uma reprovação na métrica, dois apontamentos mantidos", async () => {
    const { judge, telemetry } = juizCom([{ apontamentos: [ap("tom"), ap("tom")] }])
    const v = await judge.julgar(pedido)
    expect(v).toMatchObject({ ok: true, aprovado: false, graves: ["tom"] })
    expect(v.ok && v.apontamentos).toHaveLength(2)
    expect(metricasDoJuiz(telemetry)).toMatchObject([
      { nome: "ritu_juiz_reprovacoes_total", rotulos: { motivo: "tom" } },
    ])
  })
})
