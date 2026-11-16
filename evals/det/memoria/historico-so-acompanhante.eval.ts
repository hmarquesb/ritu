import { describe, expect, it } from "vitest"
import { historicoRecenteTool } from "@/core/agents/tools/memoria"
import { filtroVazio } from "@/core/knowledge/filtros"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import type { Caminho } from "@/core/runs/ports"
import type { ToolContext } from "@/core/tools/tool"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"

const CONTA = "conta-1"
const HOJE = "2026-01-15"

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

// Um run concluído, de um caminho qualquer, com momento para o histórico o mostrar.
async function criarRun(stores: ReturnType<typeof ambiente>["stores"], caminho: Caminho) {
  const run = await stores.runs.criar(CONTA, {
    caminho,
    intencoes: [],
    dia: HOJE,
  })
  await stores.runs.atualizar(CONTA, run.id, {
    status: "done",
    momento: { estados: ["sem_energia"], momento_do_dia: "manha", gunas_buscadas: ["quente"] },
  })
  return run
}

describe("historico.recente só traz runs do Acompanhante", () => {
  it("um run de cada outro caminho (casa, fora, alerta, ofensa) fica fora do histórico", async () => {
    const { ctx, stores } = ambiente()
    for (const caminho of ["casa", "fora", "alerta", "ofensa", "retorno"] as const) {
      await criarRun(stores, caminho)
    }

    const r = await historicoRecenteTool.execute({}, ctx)

    expect(r.runs).toEqual([])
  })

  it("com um run do Acompanhante entre outros caminhos, só ele aparece", async () => {
    const { ctx, stores } = ambiente()
    await criarRun(stores, "fora")
    const acompanhante = await criarRun(stores, "acompanhante")
    await criarRun(stores, "casa")

    const r = await historicoRecenteTool.execute({}, ctx)

    expect(acompanhante.caminho).toBe("acompanhante")
    expect(r.runs).toHaveLength(1)
    expect(r.runs[0]?.estados).toEqual(["sem_energia"])
  })
})
