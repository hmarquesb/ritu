import { describe, expect, it } from "vitest"
import { substitutosTool } from "@/core/agents/tools/ayurveda"
import { filtroVazio } from "@/core/knowledge/filtros"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import type { ToolContext } from "@/core/tools/tool"
import { getContainer } from "@/infra/container"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"

const kb = getContainer().knowledge

function ctx(parcial: Partial<ToolContext> = {}): ToolContext {
  return {
    kb,
    filtro: filtroVazio,
    sinais: sinaisVazios,
    clima: { fonte: createFakeWeather() },
    contaId: "conta-1",
    stores: createMemoryStores(createFixedClock("2026-01-15T12:00:00Z")),
    clock: createFixedClock("2026-01-15T12:00:00Z"),
    ...parcial,
  }
}

describe("substitutos da canela", () => {
  it("o primeiro substituto é quente e tempero", async () => {
    const r = await substitutosTool.execute({ alimento_id: "canela" }, ctx())
    const primeiro = r.substitutos[0]
    const alimento = primeiro ? kb.alimento(primeiro.alimento_id) : undefined

    expect(alimento?.virya).toBe("quente")
    expect(alimento?.funcoes).toContain("tempero")
  })

  it("todos os substitutos têm virya quente, como a canela", async () => {
    const r = await substitutosTool.execute({ alimento_id: "canela" }, ctx())

    expect(r.substitutos.length).toBeGreaterThan(0)
    for (const s of r.substitutos) {
      expect(kb.alimento(s.alimento_id)?.virya, s.alimento_id).toBe("quente")
    }
  })

  it("com o primeiro substituto em nao_gosta, ele some", async () => {
    const base = await substitutosTool.execute({ alimento_id: "canela" }, ctx())
    const primeiro = base.substitutos[0]?.alimento_id ?? ""

    const r = await substitutosTool.execute(
      { alimento_id: "canela" },
      ctx({ filtro: { ...filtroVazio, nao_gosta: [primeiro] } }),
    )

    expect(r.substitutos.map((s) => s.alimento_id)).not.toContain(primeiro)
  })

  it("com filtro que elimina todos os candidatos, a lista sai vazia", async () => {
    const mesmoGrupo = kb.alimentos
      .filter((a) => a.grupo === "especiarias" && a.id !== "canela")
      .map((a) => a.id)

    const r = await substitutosTool.execute(
      { alimento_id: "canela" },
      ctx({ filtro: { ...filtroVazio, nao_gosta: mesmoGrupo } }),
    )

    expect(r.substitutos).toEqual([])
  })
})
