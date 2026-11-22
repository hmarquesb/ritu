import { llmCotas } from "@config/llm-cotas"
import { describe, expect, it } from "vitest"
import { LlmError } from "@/core/llm/errors"
import { createModelRouter, type Troca } from "@/core/llm/router"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"

// Com três chaves, cada modelo vira três rotas (modelo@1, @2, @3). Um 429 na chave 1 passa para a chave 2
// do mesmo modelo, sem trocar de modelo. Sem rede, sem banco, sem chave.

const [decisao0] = llmCotas.papeis.decisao

function setup() {
  const clock = createFixedClock("2026-06-01T20:00:10Z")
  const ledger = createMemoryLedger(clock)
  const telemetry = createMemoryTelemetry()
  const router = createModelRouter({ ledger, clock, telemetry, chaves: [1, 2, 3] })
  return { router }
}

describe("varias chaves: 429 troca de chave antes de trocar de modelo", () => {
  it("a primeira rota do papel é a chave 1 do principal", async () => {
    const { router } = setup()
    expect((await router.paraPapel("decisao").proximo())?.modelo).toBe(`${decisao0}@1`)
  })

  it("429 na chave 1 passa para a chave 2 do mesmo modelo, avisando a troca", async () => {
    const { router } = setup()
    const trocas: Troca[] = []
    const fornecedor = router.paraPapel("decisao", { aoTrocar: (t) => trocas.push(t) })

    const primeira = await fornecedor.proximo()
    await fornecedor.falhou(primeira?.modelo as string, new LlmError("rate_limit", "429"))
    const segunda = await fornecedor.proximo()

    expect(segunda?.modelo).toBe(`${decisao0}@2`)
    expect(segunda?.troca).toEqual({ de: `${decisao0}@1`, motivo: "429" })
    expect(trocas).toHaveLength(1)
    expect(trocas[0]).toMatchObject({
      papel: "decisao",
      de: decisao0,
      para: decisao0,
      motivo: "429",
      chave_de: 1,
      chave_para: 2,
    })
  })

  it("429 nas chaves 1 e 2 leva à chave 3, ainda do mesmo modelo", async () => {
    const { router } = setup()
    const fornecedor = router.paraPapel("decisao")

    const r1 = await fornecedor.proximo()
    await fornecedor.falhou(r1?.modelo as string, new LlmError("rate_limit", "429"))
    const r2 = await fornecedor.proximo()
    await fornecedor.falhou(r2?.modelo as string, new LlmError("rate_limit", "429"))
    const r3 = await fornecedor.proximo()

    expect(r3?.modelo).toBe(`${decisao0}@3`)
  })
})
