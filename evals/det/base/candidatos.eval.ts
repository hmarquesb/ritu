import { describe, expect, it } from "vitest"
import { candidatosTool } from "@/core/agents/tools/ayurveda"
import type { ToolContext } from "@/core/agents/tools/tool"
import { filtroVazio } from "@/core/knowledge/filtros"
import { qualidadesDoMomento } from "@/core/knowledge/momento"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import { getContainer } from "@/infra/container"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"

const kb = getContainer().knowledge
const ctx: ToolContext = {
  kb,
  filtro: filtroVazio,
  sinais: sinaisVazios,
  clima: { fonte: createFakeWeather() },
  contaId: "conta-1",
  stores: createMemoryStores(createFixedClock("2026-01-15T12:00:00Z")),
  clock: createFixedClock("2026-01-15T12:00:00Z"),
}

const MINIMO_POR_TIPO = 3

describe("candidatos por estado da base real", () => {
  it.each(kb.estados)("$id: há práticas e preparos suficientes, sem contraindicação", async (e) => {
    const { buscadas } = qualidadesDoMomento({ estados: [e.id] }, kb)

    for (const tipo of ["pratica", "preparo"] as const) {
      const r = await candidatosTool.execute({ tipo, buscadas, estados: [e.id] }, ctx)

      expect(r.candidatos.length, tipo).toBeGreaterThanOrEqual(MINIMO_POR_TIPO)
      for (const c of r.candidatos) {
        expect(kb.linha(c.linha_base), c.linha_base).toBeDefined()
        const contraindicacoes =
          tipo === "pratica"
            ? kb.pratica(c.id)?.contraindicacoes
            : kb.preparo(c.id)?.contraindicacoes
        expect(contraindicacoes ?? [], c.id).not.toContain(e.id)
      }
    }
  })
})
