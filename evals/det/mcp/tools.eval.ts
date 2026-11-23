import { describe, expect, it } from "vitest"
import {
  alimentoTool,
  candidatosTool,
  checarCombinacaoTool,
  substitutosTool,
} from "@/core/agents/tools/ayurveda"
import { filtroVazio } from "@/core/knowledge/filtros"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import { contextoPublico, type DepsPublicas, storesProibidos } from "@/core/mcp/contexto"
import { AVISO, FONTE_CLIMA, TOOLS_PUBLICAS } from "@/core/mcp/tools"
import type { ToolContext } from "@/core/tools/tool"
import { createFakeCities } from "@/infra/fakes/fake-cities"
import { createFakeWeather, type FakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"

const CLOCK = "2026-01-15T12:00:00Z"

function deps(): DepsPublicas & { clima: FakeWeather } {
  return {
    kb: createMiniKnowledge(),
    clima: createFakeWeather(),
    cidades: createFakeCities(),
    clock: createFixedClock(CLOCK),
    telemetry: createMemoryTelemetry(),
  }
}

function neutro(d: DepsPublicas): ToolContext {
  return {
    kb: d.kb,
    filtro: filtroVazio,
    sinais: sinaisVazios,
    clima: { fonte: d.clima },
    contaId: "referencia",
    stores: createMemoryStores(createFixedClock(CLOCK)),
    clock: d.clock,
    telemetry: d.telemetry,
  }
}

function publica(nome: string) {
  const tool = TOOLS_PUBLICAS.find((t) => t.nome === nome)
  if (!tool) throw new Error(`tool pública ausente: ${nome}`)
  return tool
}

describe("as seis tools públicas", () => {
  it("são as seis e só elas", () => {
    expect(TOOLS_PUBLICAS.map((t) => t.nome)).toEqual([
      "ayurveda_alimento",
      "ayurveda_candidatos",
      "ayurveda_substitutos",
      "ayurveda_checar_combinacao",
      "clima_agora",
      "clima_proximas_horas",
    ])
  })
})

describe("mesmo resultado das internas com contexto neutro", () => {
  it("alimento, candidatos sem e com dosha, substitutos sem em_casa e combinação", async () => {
    const d = deps()
    const ctx = neutro(d)

    expect(await publica("ayurveda_alimento").executar({ alimentos: ["banana"] }, d)).toEqual({
      ...(await alimentoTool.execute({ alimentos: ["banana"] }, ctx)),
      aviso: AVISO,
    })

    const cand = { tipo: "pratica" as const, buscadas: ["quente" as const] }
    expect(await publica("ayurveda_candidatos").executar(cand, d)).toEqual({
      ...(await candidatosTool.execute(cand, ctx)),
      aviso: AVISO,
    })
    const comDosha = await candidatosTool.execute(
      cand,
      contextoPublico(d, { prakriti: { vata: 1 } }),
    )
    expect(await publica("ayurveda_candidatos").executar({ ...cand, dosha: "vata" }, d)).toEqual({
      ...comDosha,
      aviso: AVISO,
    })

    const subs = await substitutosTool.execute({ alimento_id: "canela" }, ctx)
    const publico = (await publica("ayurveda_substitutos").executar(
      { alimento_id: "canela" },
      d,
    )) as {
      substitutos: Record<string, unknown>[]
    }
    expect(publico.substitutos.every((s) => !("em_casa" in s))).toBe(true)
    expect(publico.substitutos.map((s) => s.alimento_id)).toEqual(
      subs.substitutos.map((s) => s.alimento_id),
    )

    expect(
      await publica("ayurveda_checar_combinacao").executar({ itens: ["leite", "limao"] }, d),
    ).toEqual({
      ...(await checarCombinacaoTool.execute({ itens: ["leite", "limao"] }, ctx)),
      aviso: AVISO,
    })
  })
})

describe("clima", () => {
  it("cidade achada, não achada e Open-Meteo fora do ar", async () => {
    const d = deps()
    const achada = await publica("clima_agora").executar({ cidade: "Recife" }, d)
    expect(achada).toMatchObject({
      status: "ok",
      regiao: "PE",
      pais: "Brasil",
      fonte: FONTE_CLIMA,
      aviso: AVISO,
    })

    expect(await publica("clima_agora").executar({ cidade: "Zzzzzz" }, d)).toEqual({
      status: "cidade_nao_encontrada",
      aviso: AVISO,
    })

    d.clima.foraDoAr(true)
    expect(await publica("clima_proximas_horas").executar({ cidade: "Recife" }, d)).toEqual({
      status: "indisponivel",
      aviso: AVISO,
    })
  })
})

describe("aviso e schema de saída", () => {
  it("toda saída traz aviso e passa no schema de saída; nenhum caso toca storesProibidos", async () => {
    const d = deps()
    const casos: [string, unknown][] = [
      ["ayurveda_alimento", { alimentos: ["banana"] }],
      ["ayurveda_candidatos", { tipo: "pratica", buscadas: ["quente"] }],
      ["ayurveda_substitutos", { alimento_id: "canela" }],
      ["ayurveda_checar_combinacao", { itens: ["leite", "limao"] }],
      ["clima_agora", { cidade: "Recife" }],
      ["clima_proximas_horas", { cidade: "Recife" }],
    ]
    for (const [nome, entrada] of casos) {
      const tool = publica(nome)
      const saida = await tool.executar(entrada, d)
      expect(saida).toMatchObject({ aviso: AVISO })
      expect(tool.saida.safeParse(saida).success).toBe(true)
    }
    expect(() => storesProibidos.pantry).toThrow()
  })
})
