import { describe, expect, it } from "vitest"
import { createMemoryAgent } from "@/core/agents/memory/memoria"
import { createModelRouter } from "@/core/llm/router"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger, createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { createRoutine } from "./index"

const CONTA = "conta-1"
const kb = createMiniKnowledge()

function montar(respostas: unknown[] = []) {
  const clock = createFixedClock("2026-06-03T20:00:00Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const ledger = createMemoryLedger(clock)
  const router = createModelRouter({ ledger, clock, telemetry })
  const client = createFakeLlm(respostas)
  const memory = createMemoryAgent({ router, client, kb, telemetry, clock })
  const rotina = createRoutine({ stores, tx: stores, memory, kb, telemetry })
  return { rotina, stores }
}

describe("createRoutine", () => {
  it("apagarNota tira a nota das ativas", async () => {
    const { rotina, stores } = montar()
    const almoco = await stores.routine.anotar(CONTA, "almoço fora")
    await stores.routine.anotar(CONTA, "trabalho em casa")

    await rotina.apagarNota(CONTA, almoco.id)

    const ativas = await stores.routine.notasAtivas(CONTA)
    expect(ativas.map((n) => n.texto)).toEqual(["trabalho em casa"])
  })

  it("corrigirNota troca o texto e devolve a nota nova", async () => {
    const { rotina, stores } = montar()
    const nota = await stores.routine.anotar(CONTA, "trabalho em casa")

    const nova = await rotina.corrigirNota(CONTA, nota.id, "trabalho em casa, dois dias")

    expect(nova.texto).toBe("trabalho em casa, dois dias")
    const ativas = await stores.routine.notasAtivas(CONTA)
    expect(ativas.map((n) => n.texto)).toEqual(["trabalho em casa, dois dias"])
  })

  it("atualizarResumo grava o resumo de uma nota e devolve a origem direta", async () => {
    const { rotina, stores } = montar()
    await stores.routine.anotar(CONTA, "caminhada de manhã")

    const feito = await rotina.atualizarResumo(CONTA)

    expect(feito.origem).toBe("direto")
    expect(feito.gravou).toBe(true)
    expect((await stores.routine.resumo(CONTA))?.texto).toBeTruthy()
  })

  it("atualizarResumo sem notas nem resumo anterior não grava nada e não chama o modelo", async () => {
    const { rotina, stores } = montar()

    const feito = await rotina.atualizarResumo(CONTA)

    expect(feito.origem).toBe("vazio")
    expect(feito.gravou).toBe(false)
    expect(feito.tokens).toEqual({ entrada: 0, saida: 0 })
    expect(await stores.routine.resumo(CONTA)).toBeUndefined()
  })
})
