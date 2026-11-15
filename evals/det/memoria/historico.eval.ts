import { describe, expect, it } from "vitest"
import { historicoRecenteTool } from "@/core/agents/tools/memoria"
import { filtroVazio } from "@/core/knowledge/filtros"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import type { ToolContext } from "@/core/tools/tool"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"

const CONTA = "conta-1"
const HOJE = "2026-01-15"
const TEXTO_DA_PESSOA = "Estou com uma dor de cabeça que não passa desde ontem"

function ambiente() {
  const clock = createFixedClock("2026-01-15T12:00:00-03:00")
  const stores = createMemoryStores(clock)
  const ctx: ToolContext = {
    kb: createMiniKnowledge(),
    filtro: filtroVazio,
    sinais: sinaisVazios,
    clima: { fonte: createFakeWeather() },
    contaId: CONTA,
    stores,
    clock,
    telemetry: createMemoryTelemetry(),
  }
  return { ctx, stores }
}

describe("historico.recente", () => {
  it("traz momento e sugestões, sem o texto da conversa nem o incômodo", async () => {
    const { ctx, stores } = ambiente()
    const run = await stores.runs.criar(CONTA, {
      caminho: "acompanhante",
      intencoes: [],
      dia: HOJE,
    })
    await stores.runs.atualizar(CONTA, run.id, {
      status: "done",
      com_incomodo: true,
      momento: {
        estados: ["sem_energia"],
        momento_do_dia: "manha",
        gunas_buscadas: ["quente"],
      },
    })
    await stores.messages.gravar(CONTA, {
      run_id: run.id,
      autor: "pessoa",
      texto: TEXTO_DA_PESSOA,
      com_incomodo: true,
      dia: HOJE,
    })
    await stores.messages.marcarIncomodoDoRun(CONTA, run.id)
    await stores.outcomes.criar(CONTA, run.id, [
      { tipo: "cha", titulo: "Chá de gengibre", alimentos: ["gengibre"] },
    ])

    const r = await historicoRecenteTool.execute({}, ctx)

    expect(r.runs).toHaveLength(1)
    expect(r.runs[0]).toEqual({
      dia: HOJE,
      momento_do_dia: "manha",
      estados: ["sem_energia"],
      sugestoes: [{ titulo: "Chá de gengibre", resultado: "aguardando" }],
    })
    const serializado = JSON.stringify(r)
    expect(serializado).not.toContain(TEXTO_DA_PESSOA)
    expect(serializado).not.toContain("com_incomodo")
  })
})
