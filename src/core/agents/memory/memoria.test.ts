import { llmCotas } from "@config/llm-cotas"
import { describe, expect, it } from "vitest"
import { createModelRouter } from "@/core/llm/router"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { memoriaV1 } from "../prompts/memoria.v1"
import { createMemoryAgent } from "./memoria"

const kb = createMiniKnowledge()
const NOTAS = [
  { texto: "NOTA-SECRETA almoço fora", criado_em: "2026-06-01T10:00:00Z" },
  { texto: "trabalho em casa", criado_em: "2026-06-02T10:00:00Z" },
]

function setup(respostas: unknown[], limites = {}) {
  const clock = createFixedClock("2026-06-03T20:00:00Z")
  const ledger = createMemoryLedger(clock, limites)
  const telemetry = createMemoryTelemetry()
  const router = createModelRouter({ ledger, clock, telemetry })
  const client = createFakeLlm(respostas)
  const memory = createMemoryAgent({ router, client, kb, telemetry, clock })
  return { memory, client, telemetry }
}

const POR_CODIGO = "Trabalho em casa. NOTA-SECRETA almoço fora."

describe("createMemoryAgent", () => {
  it("resumo válido vira origem modelo, com o modelo e os tokens", async () => {
    const { memory } = setup([{ resumo: "Você almoça fora e trabalha em casa." }])
    const r = await memory.resumir(NOTAS)
    expect(r.origem).toBe("modelo")
    expect(r.texto).toBe("Você almoça fora e trabalha em casa.")
    expect(r.modelo).toBe(llmCotas.papeis.apoio[0])
    expect(r.tokens).toEqual({ entrada: 10, saida: 5 })
    expect(r.duracao_ms).toBe(0)
  })

  it.each([
    ["vazio", ""],
    ["de 1201 caracteres", "a".repeat(1201)],
    ["com palavra de incômodo", "Você tem dor de cabeça."],
  ])("resumo %s cai no código, mantendo o que foi gasto", async (_nome, resumo) => {
    const { memory } = setup([{ resumo }])
    const r = await memory.resumir(NOTAS)
    expect(r.origem).toBe("codigo")
    expect(r.texto).toBe(POR_CODIGO)
    expect(r.modelo).toBe(llmCotas.papeis.apoio[0])
    expect(r.tokens).toEqual({ entrada: 10, saida: 5 })
  })

  it("erro do modelo cai no código", async () => {
    const { memory } = setup([{ erro: "indisponivel" }])
    const r = await memory.resumir(NOTAS)
    expect(r).toMatchObject({ origem: "codigo", texto: POR_CODIGO })
  })

  it("apoio esgotado cai no código, sem tokens nem modelo", async () => {
    const zero = { rpm: 0, tpm: 0, rpd: 0 }
    const limites = Object.fromEntries(llmCotas.papeis.apoio.map((m) => [m, zero]))
    const { memory } = setup([], limites)
    const r = await memory.resumir(NOTAS)
    expect(r).toMatchObject({ origem: "codigo", tokens: { entrada: 0, saida: 0 } })
    expect(r.modelo).toBeUndefined()
  })

  it("exceção comum (fila vazia) cai no código", async () => {
    const { memory } = setup([])
    const r = await memory.resumir(NOTAS)
    expect(r).toMatchObject({ origem: "codigo", texto: POR_CODIGO })
  })

  it("o pedido leva as instruções da v1 e a entrada delimitada", async () => {
    const { memory, client } = setup([{ resumo: "Ok." }])
    await memory.resumir(NOTAS)
    const [p] = client.pedidos as { instrucoes: string; entrada: string }[]
    expect(p?.instrucoes).toBe(memoriaV1.instrucoes)
    expect(p?.entrada).toContain("<notas_de_rotina>")
    expect(p?.entrada).toContain("NOTA-SECRETA")
  })

  it("o span memoria.resumo leva resumo.origem e nenhum texto", async () => {
    const { memory, telemetry } = setup([{ resumo: "Você almoça fora." }])
    await memory.resumir(NOTAS)
    const span = telemetry.spans.find((s) => s.nome === "memoria.resumo")
    expect(span?.atributos).toMatchObject({ "resumo.origem": "modelo" })
    expect(JSON.stringify(telemetry.spans)).not.toContain("NOTA-SECRETA")
    expect(JSON.stringify(telemetry.spans)).not.toContain("almoça")
  })
})
