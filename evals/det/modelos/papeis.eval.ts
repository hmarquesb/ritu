import { llmCotas, type Papel } from "@config/llm-cotas"
import { describe, expect, it } from "vitest"
import { createModelRouter } from "@/core/llm/router"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"

const PAPEIS = Object.keys(llmCotas.papeis) as Papel[]

function roteador() {
  const clock = createFixedClock("2026-01-15T12:00:00Z")
  const router = createModelRouter({
    ledger: createMemoryLedger(clock),
    clock,
    telemetry: createMemoryTelemetry(),
  })
  return { router }
}

describe("papéis: cada papel pede o principal enquanto há cota", () => {
  it.each(PAPEIS)("papel %s: a primeira escolha é o principal, sem troca", async (papel) => {
    const { router } = roteador()
    const escolha = await router.paraPapel(papel).proximo()
    expect(escolha).toEqual({ modelo: llmCotas.papeis[papel][0] })
  })

  it.each(PAPEIS)(
    "papel %s: segue no principal nas chamadas seguintes da mesma janela",
    async (papel) => {
      const { router } = roteador()
      const fornecedor = router.paraPapel(papel)
      for (let i = 0; i < 3; i++) {
        expect(await fornecedor.proximo()).toEqual({ modelo: llmCotas.papeis[papel][0] })
      }
    },
  )
})
