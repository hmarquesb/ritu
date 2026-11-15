import { describe, expect, it } from "vitest"
import { LlmError } from "@/core/runs/agent-runtime"
import { createFixedClock } from "./fixed-clock"
import { createScriptedRuntime } from "./scripted-runtime"

const PEDIDO = {
  instrucoes: "instruções de teste",
  mensagens: [{ papel: "pessoa" as const, conteudo: "oi" }],
  tools: [],
  modelo: "modelo-a",
  timeoutMs: 1000,
}

describe("createScriptedRuntime", () => {
  it("devolve os passos do roteiro na ordem e guarda os pedidos", async () => {
    const runtime = createScriptedRuntime([{ texto: "primeiro" }, { texto: "segundo" }])

    const a = await runtime.passo(PEDIDO)
    const b = await runtime.passo({ ...PEDIDO, modelo: "modelo-b" })

    expect(a.texto).toBe("primeiro")
    expect(b.texto).toBe("segundo")
    expect(runtime.pedidos).toHaveLength(2)
    expect(runtime.pedidos[0]).toEqual(PEDIDO)
    expect(runtime.pedidos[1]?.modelo).toBe("modelo-b")
  })

  it("numera as chamadas de tool como c1, c2, … sequenciais", async () => {
    const runtime = createScriptedRuntime([
      {
        chamadas: [
          { nome: "clima", argumentos: { cidade: "x" } },
          { nome: "casa", argumentos: {} },
        ],
      },
      { chamadas: [{ nome: "gostos", argumentos: {} }] },
    ])

    const a = await runtime.passo(PEDIDO)
    const b = await runtime.passo(PEDIDO)

    expect(a.chamadas).toEqual([
      { id: "c1", nome: "clima", argumentos: { cidade: "x" } },
      { id: "c2", nome: "casa", argumentos: {} },
    ])
    expect(b.chamadas).toEqual([{ id: "c3", nome: "gostos", argumentos: {} }])
  })

  it("usa 100 de entrada e 20 de saída como tokens padrão", async () => {
    const runtime = createScriptedRuntime([
      { texto: "ok" },
      { texto: "ok", tokens: { entrada: 7, saida: 3 } },
    ])

    const padrao = await runtime.passo(PEDIDO)
    const explicito = await runtime.passo(PEDIDO)

    expect(padrao.tokens_entrada).toBe(100)
    expect(padrao.tokens_saida).toBe(20)
    expect(explicito.tokens_entrada).toBe(7)
    expect(explicito.tokens_saida).toBe(3)
  })

  it("demoraMs avança o relógio fixo", async () => {
    const clock = createFixedClock("2026-01-15T12:00:00Z")
    const runtime = createScriptedRuntime([{ texto: "lento", demoraMs: 2500 }], clock)

    await runtime.passo(PEDIDO)

    expect(clock.now().toISOString()).toBe("2026-01-15T12:00:02.500Z")
  })

  it("com erro, lança LlmError com o código", async () => {
    const runtime = createScriptedRuntime([{ erro: "rate_limit" }])

    const chamada = runtime.passo(PEDIDO)

    await expect(chamada).rejects.toBeInstanceOf(LlmError)
    await expect(createScriptedRuntime([{ erro: "timeout" }]).passo(PEDIDO)).rejects.toMatchObject({
      code: "timeout",
    })
  })

  it("com o roteiro esgotado, lança Error('roteiro esgotado')", async () => {
    const runtime = createScriptedRuntime([{ texto: "único" }])
    await runtime.passo(PEDIDO)

    await expect(runtime.passo(PEDIDO)).rejects.toThrow("roteiro esgotado")
  })
})
