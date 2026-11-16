import { describe, expect, it } from "vitest"
import type { MemoryAgent } from "@/core/agents/memory/memoria"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { atualizarResumo } from "./resumo"

const CONTA = "conta-1"

function setup(resumir?: MemoryAgent["resumir"]) {
  const clock = createFixedClock("2026-06-03T20:00:00Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const chamadas: number[] = []
  const memory: MemoryAgent = {
    resumir:
      resumir ??
      (async () => {
        chamadas.push(1)
        return {
          texto: "Resumo do modelo.",
          origem: "modelo",
          modelo: "m",
          tokens: { entrada: 3, saida: 2 },
          trocas: 0,
          duracao_ms: 4,
        }
      }),
  }
  const rodar = () => atualizarResumo({ stores, memory, telemetry }, CONTA)
  return { stores, telemetry, rodar, chamadas, clock }
}

describe("atualizarResumo", () => {
  it("sem nota e sem resumo: vazio, não grava", async () => {
    const { rodar, stores, telemetry } = setup()
    expect(await rodar()).toMatchObject({ origem: "vazio", gravou: false })
    expect(await stores.routine.resumo(CONTA)).toBeUndefined()
    expect(telemetry.metricas).toEqual([])
  })

  it("uma nota: direto, grava a própria nota, sem chamar a Memória", async () => {
    const { rodar, stores } = setup(async () => {
      throw new Error("não devia chamar")
    })
    await stores.routine.anotar(CONTA, "almoço fora")
    expect(await rodar()).toMatchObject({ origem: "direto", gravou: true })
    expect((await stores.routine.resumo(CONTA))?.texto).toBe("Almoço fora.")
  })

  it("duas notas: chama a Memória e devolve modelo e tokens", async () => {
    const { rodar, stores, chamadas } = setup()
    await stores.routine.anotar(CONTA, "almoço fora")
    await stores.routine.anotar(CONTA, "trabalho em casa")
    expect(await rodar()).toEqual({
      origem: "modelo",
      gravou: true,
      modelo: "m",
      tokens: { entrada: 3, saida: 2 },
      duracao_ms: 4,
    })
    expect(chamadas).toHaveLength(1)
  })

  it("segunda vez sem mudança não grava; a versão nova soma 1", async () => {
    const { rodar, stores } = setup()
    await stores.routine.anotar(CONTA, "almoço fora")
    await rodar()
    expect((await rodar()).gravou).toBe(false)
    await stores.routine.anotar(CONTA, "trabalho em casa")
    await rodar()
    const resumo = await stores.routine.resumo(CONTA)
    expect(resumo).toMatchObject({ versao: 2, texto: "Resumo do modelo." })
  })

  it("apagar a última nota com resumo guardado grava texto vazio", async () => {
    const { rodar, stores } = setup()
    const nota = await stores.routine.anotar(CONTA, "almoço fora")
    await rodar()
    await stores.routine.desativar(CONTA, nota.id)
    expect(await rodar()).toMatchObject({ origem: "vazio", gravou: true })
    expect(await stores.routine.resumo(CONTA)).toMatchObject({ versao: 2, texto: "" })
  })

  it("a métrica soma com a origem só quando grava", async () => {
    const { rodar, stores, telemetry } = setup()
    await stores.routine.anotar(CONTA, "almoço fora")
    await rodar()
    await rodar()
    expect(telemetry.metricas).toHaveLength(1)
    expect(telemetry.metricas[0]).toMatchObject({
      nome: "ritu_rotina_resumo_total",
      rotulos: { origem: "direto" },
    })
  })
})
