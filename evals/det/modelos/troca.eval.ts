import { llmCotas } from "@config/llm-cotas"
import { describe, expect, it } from "vitest"
import { LlmError } from "@/core/llm/errors"
import { createModelRouter, type Troca } from "@/core/llm/router"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"

const [principal, segundo] = llmCotas.papeis.decisao
const LIMITE_FOLGADO = { rpm: 100, tpm: 250_000, rpd: 500 }

function montar(limitesPorTeste: Parameters<typeof createMemoryLedger>[1] = {}) {
  const clock = createFixedClock("2026-01-15T12:00:00Z")
  const telemetry = createMemoryTelemetry()
  const router = createModelRouter({
    ledger: createMemoryLedger(clock, limitesPorTeste),
    clock,
    telemetry,
  })
  return { clock, telemetry, router }
}

function trocasNaMetrica(telemetry: ReturnType<typeof createMemoryTelemetry>) {
  return telemetry.metricas.filter((m) => m.nome === "ritu_llm_troca_de_modelo_total")
}

describe("troca: cota do minuto", () => {
  it("passado o rpm do principal na janela, a escolha vai ao próximo com motivo cota", async () => {
    const { router, telemetry } = montar({
      [principal]: { ...LIMITE_FOLGADO, rpm: 2 },
    })
    const trocas: Troca[] = []
    const fornecedor = router.paraPapel("decisao", { aoTrocar: (t) => trocas.push(t) })
    await fornecedor.proximo()
    await fornecedor.proximo()
    const terceira = await fornecedor.proximo()

    expect(terceira).toEqual({ modelo: segundo, troca: { de: principal, motivo: "cota" } })
    expect(trocas).toEqual([{ papel: "decisao", de: principal, para: segundo, motivo: "cota" }])
    expect(trocasNaMetrica(telemetry)).toEqual([
      expect.objectContaining({
        valor: 1,
        rotulos: { papel: "decisao", de: principal, para: segundo, motivo: "cota" },
      }),
    ])
  })

  it("na janela seguinte do minuto, volta ao principal", async () => {
    const { clock, router } = montar({ [principal]: { ...LIMITE_FOLGADO, rpm: 1 } })
    const fornecedor = router.paraPapel("decisao")
    await fornecedor.proximo()
    expect(await fornecedor.proximo()).toEqual({
      modelo: segundo,
      troca: { de: principal, motivo: "cota" },
    })
    clock.advance(60_000)
    expect(await fornecedor.proximo()).toEqual({
      modelo: principal,
      troca: { de: segundo, motivo: "cota" },
    })
  })

  it("sem troca, o gancho e a métrica não são acionados", async () => {
    const { router, telemetry } = montar()
    const trocas: Troca[] = []
    const fornecedor = router.paraPapel("decisao", { aoTrocar: (t) => trocas.push(t) })
    await fornecedor.proximo()
    await fornecedor.proximo()
    expect(trocas).toEqual([])
    expect(trocasNaMetrica(telemetry)).toEqual([])
  })
})

describe("troca: cota do dia", () => {
  it("passado o rpd do principal no dia, a escolha vai ao próximo com motivo cota", async () => {
    const { router, telemetry } = montar({ [principal]: { ...LIMITE_FOLGADO, rpd: 2 } })
    const trocas: Troca[] = []
    const fornecedor = router.paraPapel("decisao", { aoTrocar: (t) => trocas.push(t) })
    await fornecedor.proximo()
    await fornecedor.proximo()
    expect(await fornecedor.proximo()).toEqual({
      modelo: segundo,
      troca: { de: principal, motivo: "cota" },
    })
    expect(trocas).toEqual([{ papel: "decisao", de: principal, para: segundo, motivo: "cota" }])
    expect(trocasNaMetrica(telemetry)).toHaveLength(1)
  })
})

describe("troca: erro 429", () => {
  it("rate_limit no principal leva ao próximo com motivo 429, no gancho e na métrica", async () => {
    const { router, telemetry } = montar()
    const trocas: Troca[] = []
    const fornecedor = router.paraPapel("decisao", { aoTrocar: (t) => trocas.push(t) })
    const primeira = await fornecedor.proximo()
    await fornecedor.falhou(
      primeira?.modelo ?? "",
      new LlmError("rate_limit", "limite do provedor"),
    )

    expect(await fornecedor.proximo()).toEqual({
      modelo: segundo,
      troca: { de: principal, motivo: "429" },
    })
    expect(trocas).toEqual([{ papel: "decisao", de: principal, para: segundo, motivo: "429" }])
    expect(trocasNaMetrica(telemetry)).toEqual([
      expect.objectContaining({
        rotulos: { papel: "decisao", de: principal, para: segundo, motivo: "429" },
      }),
    ])
  })

  it("o motivo volta a cota quando o principal retorna em outra janela", async () => {
    const { clock, router } = montar()
    const fornecedor = router.paraPapel("decisao")
    await fornecedor.falhou(
      (await fornecedor.proximo())?.modelo ?? "",
      new LlmError("rate_limit", "limite do provedor"),
    )
    await fornecedor.proximo()
    clock.advance(60_000)
    expect(await fornecedor.proximo()).toEqual({
      modelo: principal,
      troca: { de: segundo, motivo: "cota" },
    })
  })
})
