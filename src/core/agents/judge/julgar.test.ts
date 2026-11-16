import { llmCotas } from "@config/llm-cotas"
import { describe, expect, it } from "vitest"
import { saidaSegura } from "@/core/agents/companion/saida"
import { createModelRouter } from "@/core/llm/router"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { juizV1 } from "../prompts/juiz.v1"
import { createJudge } from "./julgar"

const kb = createMiniKnowledge()
const TRECHO = "TRECHO-SECRETO-DA-RESPOSTA"

function setup(respostas: unknown[], limites = {}) {
  const clock = createFixedClock("2026-06-01T20:00:10Z")
  const ledger = createMemoryLedger(clock, limites)
  const telemetry = createMemoryTelemetry()
  const router = createModelRouter({ ledger, clock, telemetry })
  const client = createFakeLlm(respostas)
  const juiz = createJudge({ router, client, kb, telemetry, clock })
  return { juiz, client, telemetry }
}

const saida = { ...saidaSegura(), resposta: "Uma resposta de teste." }
const pedido = { saida, evitar: [], tentativa: 1 }

function doJuiz(telemetry: ReturnType<typeof createMemoryTelemetry>) {
  return telemetry.metricas.filter((m) => m.nome.startsWith("ritu_juiz_"))
}

function ap(motivo: string) {
  return { motivo, trecho: TRECHO }
}

describe("createJudge", () => {
  it("lista vazia aprova e soma ritu_juiz_total aprovado, sem motivo", async () => {
    const { juiz, telemetry } = setup([{ apontamentos: [] }])
    const v = await juiz.julgar(pedido)
    expect(v).toMatchObject({
      ok: true,
      aprovado: true,
      graves: [],
      registros: [],
      apontamentos: [],
    })
    expect(doJuiz(telemetry)).toEqual([
      { tipo: "contador", nome: "ritu_juiz_total", valor: 1, rotulos: { resultado: "aprovado" } },
    ])
  })

  it("promessa reprova e soma ritu_juiz_total reprovado e a métrica do motivo", async () => {
    const { juiz, telemetry } = setup([{ apontamentos: [ap("promessa")] }])
    const v = await juiz.julgar(pedido)
    expect(v).toMatchObject({ ok: true, aprovado: false, graves: ["promessa"] })
    expect(doJuiz(telemetry)).toMatchObject([
      { nome: "ritu_juiz_total", rotulos: { resultado: "reprovado" } },
      { nome: "ritu_juiz_reprovacoes_total", rotulos: { motivo: "promessa" } },
    ])
  })

  it("dois tom contam a métrica uma vez e mantêm os dois apontamentos", async () => {
    const { juiz, telemetry } = setup([{ apontamentos: [ap("tom"), ap("tom")] }])
    const v = await juiz.julgar(pedido)
    if (!v.ok) throw new Error("esperava ok")
    expect(v.graves).toEqual(["tom"])
    expect(v.apontamentos).toHaveLength(2)
    expect(telemetry.metricas.filter((m) => m.nome === "ritu_juiz_reprovacoes_total")).toHaveLength(
      1,
    )
  })

  it("só motivos desconhecidos aprova", async () => {
    const { juiz } = setup([{ apontamentos: [ap("inventado")] }])
    expect(await juiz.julgar(pedido)).toMatchObject({ ok: true, aprovado: true, apontamentos: [] })
  })

  it("jargao sozinho aprova, soma aprovado e vira registro com aviso", async () => {
    const { juiz, telemetry } = setup([{ apontamentos: [ap("jargao")] }])
    const v = await juiz.julgar(pedido)
    expect(v).toMatchObject({ ok: true, aprovado: true, registros: ["jargao"], graves: [] })
    expect(doJuiz(telemetry)).toMatchObject([
      { nome: "ritu_juiz_total", rotulos: { resultado: "aprovado" } },
      { nome: "ritu_juiz_avisos_total", rotulos: { motivo: "jargao" } },
    ])
  })

  it("saude_na_proposta com nota vira registro, aviso e campo", async () => {
    const { juiz, telemetry } = setup([{ apontamentos: [ap("saude_na_proposta")] }])
    const v = await juiz.julgar({ ...pedido, nota_de_rotina: "acordo cedo" })
    expect(v).toMatchObject({
      ok: true,
      aprovado: true,
      saude_na_proposta: true,
      registros: ["saude_na_proposta"],
    })
    expect(doJuiz(telemetry)).toMatchObject([
      { nome: "ritu_juiz_total", rotulos: { resultado: "aprovado" } },
      { nome: "ritu_juiz_avisos_total", rotulos: { motivo: "saude_na_proposta" } },
    ])
  })

  it("saude_na_proposta sem nota é descartado", async () => {
    const { juiz, telemetry } = setup([{ apontamentos: [ap("saude_na_proposta")] }])
    const v = await juiz.julgar(pedido)
    expect(v).toMatchObject({ ok: true, saude_na_proposta: false, registros: [], apontamentos: [] })
    expect(doJuiz(telemetry)).toMatchObject([
      { nome: "ritu_juiz_total", rotulos: { resultado: "aprovado" } },
    ])
  })

  it("erro do modelo vira motivo erro, falha o span e soma ritu_juiz_total sem_juiz", async () => {
    const { juiz, telemetry } = setup([{ erro: "indisponivel" }])
    expect(await juiz.julgar(pedido)).toMatchObject({ ok: false, motivo: "erro" })
    expect(telemetry.spans.find((s) => s.nome === "juiz")?.falha).toBe("erro")
    expect(doJuiz(telemetry)).toMatchObject([
      { nome: "ritu_juiz_total", rotulos: { resultado: "sem_juiz" } },
    ])
  })

  it("apoio esgotado vira sem_modelo e soma ritu_juiz_total sem_juiz", async () => {
    const zero = { rpm: 0, tpm: 0, rpd: 0 }
    const limites = Object.fromEntries(llmCotas.papeis.apoio.map((m) => [m, zero]))
    const { juiz, telemetry } = setup([], limites)
    expect(await juiz.julgar(pedido)).toMatchObject({ ok: false, motivo: "sem_modelo" })
    expect(telemetry.spans.find((s) => s.nome === "juiz")?.falha).toBe("sem_modelo")
    expect(doJuiz(telemetry)).toMatchObject([
      { nome: "ritu_juiz_total", rotulos: { resultado: "sem_juiz" } },
    ])
  })

  it("o pedido leva as instruções da v1 e a entrada montada", async () => {
    const { juiz, client } = setup([{ apontamentos: [] }])
    await juiz.julgar(pedido)
    const [p] = client.pedidos as { instrucoes: string; entrada: string }[]
    expect(p?.instrucoes).toBe(juizV1.instrucoes)
    expect(p?.entrada).toContain("<resposta>")
  })

  it("span juiz leva só tentativa e aprovado, sem trecho", async () => {
    const { juiz, telemetry } = setup([{ apontamentos: [ap("tom")] }])
    await juiz.julgar({ ...pedido, tentativa: 2 })
    const span = telemetry.spans.find((s) => s.nome === "juiz")
    expect(span?.atributos).toEqual({ "juiz.tentativa": 2, "juiz.aprovado": false })
    expect(JSON.stringify(telemetry.spans)).not.toContain(TRECHO)
    expect(JSON.stringify(doJuiz(telemetry))).not.toContain(TRECHO)
  })

  it("preferir chega ao roteador", async () => {
    const preferido = llmCotas.papeis.apoio[1]
    if (preferido === undefined) throw new Error("apoio com um modelo só")
    const { juiz } = setup([{ apontamentos: [] }])
    const v = await juiz.julgar({ ...pedido, preferir: preferido })
    expect(v).toMatchObject({ ok: true, modelo: preferido })
  })

  it("erro que não é do modelo sobe", async () => {
    const { juiz } = setup([])
    await expect(juiz.julgar(pedido)).rejects.toThrow("fake-llm")
  })
})
