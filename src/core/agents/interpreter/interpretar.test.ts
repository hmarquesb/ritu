import { llmCotas } from "@config/llm-cotas"
import { describe, expect, it } from "vitest"
import { createModelRouter } from "@/core/llm/router"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { interpreteV2 } from "../prompts/interprete.v2"
import { createInterpreter } from "./interpretar"

const kb = createMiniKnowledge()
const MENSAGEM = "MENSAGEM-SECRETA-DA-PESSOA"

const saida = {
  intencoes: ["vida"],
  estados: [],
  itens_casa: [],
  evitar_sempre: [],
  nao_come: [],
  gosta: [],
  restricoes: [],
  suspeito: false,
}

function setup(respostas: unknown[], limites = {}) {
  const clock = createFixedClock("2026-06-01T20:00:10Z")
  const ledger = createMemoryLedger(clock, limites)
  const telemetry = createMemoryTelemetry()
  const router = createModelRouter({ ledger, clock, telemetry })
  const client = createFakeLlm(respostas)
  const interprete = createInterpreter({ router, client, kb, telemetry, clock })
  return { interprete, client, telemetry }
}

const pedido = { texto: MENSAGEM, atalhos: [], conversa: [], pendentes: [] }

describe("createInterpreter", () => {
  it("saída válida vira Interpretacao normalizada, com o modelo do apoio", async () => {
    const { interprete, client } = setup([saida])
    const r = await interprete.interpretar(pedido)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.interpretacao.intencoes).toEqual(["vida"])
    expect(r.modelo).toBe(llmCotas.papeis.apoio[0])
    expect(r.tokens).toEqual({ entrada: 10, saida: 5 })
    expect(r.trocas).toBe(0)
    expect(r.duracao_ms).toBe(0)
    const [p] = client.pedidos as { instrucoes: string; entrada: string }[]
    expect(p?.instrucoes).toBe(interpreteV2.instrucoes)
    expect(p?.entrada).toContain("<mensagem_da_pessoa>")
  })

  it("span interprete com um llm.chamada filho, sem texto nos atributos", async () => {
    const { interprete, telemetry } = setup([saida])
    await interprete.interpretar(pedido)
    const indice = telemetry.spans.findIndex((s) => s.nome === "interprete")
    expect(indice).toBeGreaterThanOrEqual(0)
    const filhos = telemetry.spans.filter((s) => s.pai === indice)
    expect(filhos.map((s) => s.nome)).toEqual(["llm.chamada"])
    expect(JSON.stringify(telemetry.spans)).not.toContain(MENSAGEM)
  })

  it("erro do modelo em todas as tentativas vira motivo erro e falha o span", async () => {
    const { interprete, telemetry } = setup([{ erro: "indisponivel" }])
    const r = await interprete.interpretar(pedido)
    expect(r).toMatchObject({ ok: false, motivo: "erro" })
    expect(telemetry.spans.find((s) => s.nome === "interprete")?.falha).toBe("erro")
  })

  it("modelos do apoio esgotados viram sem_modelo", async () => {
    const zero = { rpm: 0, tpm: 0, rpd: 0 }
    const limites = Object.fromEntries(llmCotas.papeis.apoio.map((m) => [m, zero]))
    const { interprete, telemetry } = setup([], limites)
    const r = await interprete.interpretar(pedido)
    expect(r).toMatchObject({ ok: false, motivo: "sem_modelo" })
    expect(telemetry.spans.find((s) => s.nome === "interprete")?.falha).toBe("sem_modelo")
  })

  it("erro que não é do modelo sobe", async () => {
    const { interprete } = setup([])
    await expect(interprete.interpretar(pedido)).rejects.toThrow("fake-llm")
  })
})
