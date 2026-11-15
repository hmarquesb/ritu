import { describe, expect, it } from "vitest"
import { casaLerTool } from "@/core/agents/tools/memoria"
import { type FiltroPessoa, filtroVazio } from "@/core/knowledge/filtros"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import type { ToolContext } from "@/core/tools/tool"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"

const CONTA = "conta-1"

function ambiente(filtro: FiltroPessoa) {
  const clock = createFixedClock("2026-01-15T12:00:00-03:00")
  const stores = createMemoryStores(clock)
  const ctx: ToolContext = {
    kb: createMiniKnowledge(),
    filtro,
    sinais: sinaisVazios,
    clima: { fonte: createFakeWeather() },
    contaId: CONTA,
    stores,
    clock,
    telemetry: createMemoryTelemetry(),
  }
  return { ctx, stores }
}

describe("casa.ler e evitar sempre", () => {
  it("alimento da base em evitar sempre não aparece, e os outros aparecem", async () => {
    const { ctx, stores } = ambiente({
      ...filtroVazio,
      evitar: [{ tipo: "alimento", valor: "banana" }],
    })
    await stores.pantry.registrar(
      CONTA,
      [{ alimento_id: "banana" }, { alimento_id: "canela" }],
      "conversa",
    )

    const r = await casaLerTool.execute({}, ctx)

    expect(r.itens.map((i) => i.alimento_id)).toEqual(["canela"])
  })

  it("item do grupo em evitar sempre não aparece", async () => {
    const { ctx, stores } = ambiente({
      ...filtroVazio,
      evitar: [{ tipo: "grupo", valor: "leite" }],
    })
    await stores.pantry.registrar(
      CONTA,
      [{ alimento_id: "leite" }, { alimento_id: "banana" }],
      "conversa",
    )

    const r = await casaLerTool.execute({}, ctx)

    expect(r.itens.map((i) => i.alimento_id)).toEqual(["banana"])
  })

  it("nome livre que contém o texto a evitar não aparece", async () => {
    const { ctx, stores } = ambiente({
      ...filtroVazio,
      evitar: [{ tipo: "texto", valor: "pimenta" }],
    })
    await stores.pantry.registrar(CONTA, [{ nome_livre: "Pimenta caiena" }], "conversa")
    await stores.pantry.registrar(CONTA, [{ nome_livre: "Azeitona" }], "conversa")

    const r = await casaLerTool.execute({}, ctx)

    expect(r.itens.map((i) => i.nome)).toEqual(["Azeitona"])
  })
})
