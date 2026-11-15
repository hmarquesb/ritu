import { describe, expect, it } from "vitest"
import { z } from "zod"
import { filtroVazio } from "@/core/knowledge/filtros"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import type { ToolContext } from "@/core/tools/tool"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import {
  alimentoTool,
  ayurvedaTools,
  candidatosTool,
  checarCombinacaoTool,
  substitutosTool,
} from "./ayurveda"

const kb: KnowledgeBase = createMiniKnowledge()

function ctx(parcial: Partial<ToolContext> = {}): ToolContext {
  return {
    kb,
    filtro: filtroVazio,
    sinais: sinaisVazios,
    clima: { fonte: createFakeWeather() },
    contaId: "conta-1",
    stores: createMemoryStores(createFixedClock("2026-01-15T12:00:00Z")),
    clock: createFixedClock("2026-01-15T12:00:00Z"),
    telemetry: createMemoryTelemetry(),
    ...parcial,
  }
}

describe("resumir das tools de ayurveda", () => {
  it("ayurveda.alimento resume o número de alimentos, sem os nomes", async () => {
    const r = await alimentoTool.execute({ alimentos: ["banana", "canela"] }, ctx())

    expect(alimentoTool.resumir?.(r)).toBe("2 alimentos")
    expect(alimentoTool.resumir?.(r)).not.toMatch(/banana|canela/i)
  })

  it("ayurveda.candidatos resume o número de candidatos, sem os nomes", async () => {
    const r = await candidatosTool.execute({ tipo: "pratica", buscadas: ["quente"] }, ctx())

    expect(r.candidatos.length).toBeGreaterThan(0)
    expect(candidatosTool.resumir?.(r)).toBe(`${r.candidatos.length} candidatos`)
    expect(candidatosTool.resumir?.(r)).not.toContain(r.candidatos[0]?.nome ?? "")
  })

  it("ayurveda.substitutos resume o número de substitutos", async () => {
    const r = await substitutosTool.execute({ alimento_id: "canela" }, ctx())

    expect(r.substitutos.length).toBeGreaterThan(0)
    expect(substitutosTool.resumir?.(r)).toBe(`${r.substitutos.length} substitutos`)
  })

  it("ayurveda.checar_combinacao resume compatível ou o número de conflitos", async () => {
    const conflito = await checarCombinacaoTool.execute({ itens: ["leite", "limao"] }, ctx())
    const compativel = { compativel: true, conflitos: [], desconhecidos: [] }

    expect(conflito.conflitos.length).toBeGreaterThan(0)
    expect(checarCombinacaoTool.resumir?.(conflito)).toBe(`${conflito.conflitos.length} conflitos`)
    expect(checarCombinacaoTool.resumir?.(compativel)).toBe("compatível")
  })
})

describe("ayurveda.alimento", () => {
  it("identifica alimentos por nome e sinônimo, sem repetir o mesmo alimento", async () => {
    const r = await alimentoTool.execute(
      { alimentos: ["Banana-prata", "banana", "abóbora", "pitaia"] },
      ctx(),
    )

    expect(r.alimentos.map((a) => a.id)).toEqual(["banana", "abobora"])
    expect(r.desconhecidos).toEqual(["pitaia"])
  })

  it("cada alimento traz verbos das gunas com verbo e linha_base que existe na base", async () => {
    const r = await alimentoTool.execute({ alimentos: ["banana"] }, ctx())
    const banana = r.alimentos[0]

    expect(banana?.linha_base).toBe("alimentos:banana")
    expect(banana?.verbos.length).toBeGreaterThan(0)
    expect(kb.linha(banana?.linha_base ?? "")).toBeDefined()
  })

  it("rejeita lista vazia com erro de zod", async () => {
    await expect(alimentoTool.execute({ alimentos: [] }, ctx())).rejects.toBeInstanceOf(z.ZodError)
  })
})

describe("ayurveda.candidatos", () => {
  it("práticas com nota positiva, ordenadas por nota e com linha_base", async () => {
    const r = await candidatosTool.execute({ tipo: "pratica", buscadas: ["quente"] }, ctx())
    const notas = r.candidatos.map((c) => c.nota)

    expect(r.candidatos.length).toBeGreaterThan(0)
    expect(notas.every((n) => n > 0)).toBe(true)
    expect([...notas].sort((a, b) => b - a)).toEqual(notas)
    for (const c of r.candidatos) {
      expect(c.linha_base).toBe(`praticas:${c.id}`)
      expect(kb.linha(c.linha_base)).toBeDefined()
    }
  })

  it("aplica o filtro da pessoa: prática com ingrediente evitado some", async () => {
    const r = await candidatosTool.execute(
      { tipo: "pratica", buscadas: ["oleoso"] },
      ctx({ filtro: { ...filtroVazio, evitar: [{ tipo: "grupo", valor: "gergelim" }] } }),
    )

    expect(r.candidatos.map((c) => c.id)).not.toContain("oleo-pes-gergelim")
  })

  it("prática fora do momento_do_dia some", async () => {
    const r = await candidatosTool.execute(
      { tipo: "pratica", buscadas: ["oleoso"], momento_do_dia: "manha" },
      ctx(),
    )

    expect(r.candidatos.map((c) => c.id)).not.toContain("oleo-pes-gergelim")
  })

  it("prática que tem estado contraindicado some", async () => {
    const r = await candidatosTool.execute(
      { tipo: "pratica", buscadas: ["quente"], estados: ["com_calor"] },
      ctx(),
    )

    expect(r.candidatos.map((c) => c.id)).not.toContain("cha-gengibre")
  })

  it("limite padrão é 5 e o máximo aceito é 10", async () => {
    const r = await candidatosTool.execute({ tipo: "alimento", buscadas: ["quente"] }, ctx())
    expect(r.candidatos.length).toBeLessThanOrEqual(5)

    await expect(
      candidatosTool.execute({ tipo: "alimento", buscadas: ["quente"], limite: 11 }, ctx()),
    ).rejects.toBeInstanceOf(z.ZodError)
  })

  it("rejeita buscadas vazias com erro de zod", async () => {
    await expect(
      candidatosTool.execute({ tipo: "alimento", buscadas: [] }, ctx()),
    ).rejects.toBeInstanceOf(z.ZodError)
  })
})

describe("ayurveda.substitutos", () => {
  it("devolve substitutos de canela com linha_base válida", async () => {
    const r = await substitutosTool.execute({ alimento_id: "canela" }, ctx())

    expect(r.substitutos.length).toBeGreaterThan(0)
    expect(r.desconhecidos).toEqual([])
    for (const s of r.substitutos) expect(kb.linha(s.linha_base)).toBeDefined()
  })

  it("alimento desconhecido devolve lista vazia e o id em desconhecidos", async () => {
    const r = await substitutosTool.execute({ alimento_id: "xyz" }, ctx())

    expect(r).toEqual({ substitutos: [], desconhecidos: ["xyz"] })
  })
})

describe("ayurveda.checar_combinacao", () => {
  it("leite com limão não combina", async () => {
    const r = await checarCombinacaoTool.execute({ itens: ["leite", "limao"] }, ctx())

    expect(r.compativel).toBe(false)
    expect(r.conflitos.length).toBeGreaterThan(0)
    for (const c of r.conflitos) expect(kb.linha(c.linha_base)).toBeDefined()
  })

  it("id desconhecido não impede compatibilidade e vai em desconhecidos", async () => {
    const r = await checarCombinacaoTool.execute({ itens: ["arroz-branco", "xyz"] }, ctx())

    expect(r.compativel).toBe(true)
    expect(r.desconhecidos).toEqual(["xyz"])
  })

  it("exige de 2 a 8 itens", async () => {
    await expect(checarCombinacaoTool.execute({ itens: ["leite"] }, ctx())).rejects.toBeInstanceOf(
      z.ZodError,
    )
  })
})

describe("ayurvedaTools", () => {
  it("exporta as quatro tools com nomes em português", () => {
    expect(ayurvedaTools.map((t) => t.name)).toEqual([
      "ayurveda.alimento",
      "ayurveda.candidatos",
      "ayurveda.substitutos",
      "ayurveda.checar_combinacao",
    ])
  })
})
