import { describe, expect, it } from "vitest"
import { z } from "zod"
import {
  alimentoTool,
  candidatosTool,
  checarCombinacaoTool,
  substitutosTool,
} from "@/core/agents/tools/ayurveda"
import { filtroVazio } from "@/core/knowledge/filtros"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import type { ToolContext } from "@/core/tools/tool"
import { createFakeCities } from "@/infra/fakes/fake-cities"
import { createFakeWeather, type FakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import type { DepsPublicas } from "./contexto"
import { AVISO, DESCRICOES_PUBLICAS, FONTE_CLIMA, opcaoOk, TOOLS_PUBLICAS } from "./tools"

const CLOCK = "2026-01-15T12:00:00Z"

type Deps = DepsPublicas & { clima: FakeWeather }

function deps(): Deps {
  return {
    kb: createMiniKnowledge(),
    clima: createFakeWeather(),
    cidades: createFakeCities(),
    clock: createFixedClock(CLOCK),
    telemetry: createMemoryTelemetry(),
  }
}

// Contexto interno com filtro vazio, sinais vazios e sem prakriti: a referência do "mesmo resultado".
function internoNeutro(d: DepsPublicas): ToolContext {
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

describe("lista das tools públicas", () => {
  it("são as seis, nesta ordem", () => {
    expect(TOOLS_PUBLICAS.map((t) => t.nome)).toEqual([
      "ayurveda_alimento",
      "ayurveda_candidatos",
      "ayurveda_substitutos",
      "ayurveda_checar_combinacao",
      "clima_agora",
      "clima_proximas_horas",
    ])
  })

  it("cada uma tem descrição e frase curta, e DESCRICOES_PUBLICAS sai delas", () => {
    for (const tool of TOOLS_PUBLICAS) {
      expect(tool.descricao.length).toBeGreaterThan(0)
      expect(tool.curta.length).toBeGreaterThan(0)
    }
    expect(DESCRICOES_PUBLICAS).toEqual(
      TOOLS_PUBLICAS.map((t) => ({ nome: t.nome, curta: t.curta })),
    )
  })
})

describe("mesmo resultado das internas", () => {
  it("ayurveda_alimento devolve o da interna mais o aviso", async () => {
    const d = deps()
    const entrada = { alimentos: ["banana", "canela"] }
    const interna = await alimentoTool.execute(entrada, internoNeutro(d))

    const publico = await publica("ayurveda_alimento").executar(entrada, d)

    expect(publico).toEqual({ ...interna, aviso: AVISO })
  })

  it("ayurveda_candidatos sem dosha é a interna sem prakriti", async () => {
    const d = deps()
    const entrada = { tipo: "pratica" as const, buscadas: ["quente" as const] }
    const interna = await candidatosTool.execute(entrada, internoNeutro(d))

    const publico = await publica("ayurveda_candidatos").executar(entrada, d)

    expect(publico).toEqual({ ...interna, aviso: AVISO })
  })

  it("ayurveda_substitutos devolve a interna sem em_casa e com aviso", async () => {
    const d = deps()
    const entrada = { alimento_id: "canela" }
    const interna = await substitutosTool.execute(entrada, internoNeutro(d))

    const publico = await publica("ayurveda_substitutos").executar(entrada, d)

    expect(publico).toEqual({
      substitutos: interna.substitutos.map(
        ({ alimento_id, nome, em_comum, motivo, linha_base }) => ({
          alimento_id,
          nome,
          em_comum,
          motivo,
          linha_base,
        }),
      ),
      desconhecidos: interna.desconhecidos,
      aviso: AVISO,
    })
    for (const s of (publico as { substitutos: object[] }).substitutos) {
      expect(s).not.toHaveProperty("em_casa")
    }
  })

  it("ayurveda_checar_combinacao devolve a da interna mais o aviso", async () => {
    const d = deps()
    const entrada = { itens: ["leite", "limao"] }
    const interna = await checarCombinacaoTool.execute(entrada, internoNeutro(d))

    const publico = await publica("ayurveda_checar_combinacao").executar(entrada, d)

    expect(publico).toEqual({ ...interna, aviso: AVISO })
  })
})

describe("dosha", () => {
  it("ayurveda_candidatos com dosha vata usa prakriti { vata: 1 }, na ordem da interna", async () => {
    const d = deps()
    const entrada = { tipo: "pratica" as const, buscadas: ["quente" as const] }
    const internaComPrakriti = await candidatosTool.execute(entrada, {
      ...internoNeutro(d),
      prakriti: { vata: 1 },
    })

    const publico = await publica("ayurveda_candidatos").executar({ ...entrada, dosha: "vata" }, d)

    expect(publico).toEqual({ ...internaComPrakriti, aviso: AVISO })
  })
})

describe("clima", () => {
  it("clima_agora com cidade achada devolve a interna em qualidades, com regiao, pais, fonte e aviso", async () => {
    const d = deps()
    const r = await publica("clima_agora").executar({ cidade: "Recife" }, d)

    expect(r).toMatchObject({
      status: "ok",
      cidade: "Recife",
      regiao: "PE",
      pais: "Brasil",
      fonte: FONTE_CLIMA,
      aviso: AVISO,
    })
    expect(r).toHaveProperty("gunas")
    expect(r).toHaveProperty("faixa_temperatura")
  })

  it("clima_agora sem regiao na cidade não traz o campo regiao", async () => {
    const r = await publica("clima_agora").executar({ cidade: "Lisboa" }, deps())

    expect(r).toMatchObject({ status: "ok", cidade: "Lisboa", pais: "Portugal" })
    expect(r).not.toHaveProperty("regiao")
  })

  it("clima_proximas_horas com cidade achada devolve a tendência, com fonte e aviso", async () => {
    const d = deps()
    const r = await publica("clima_proximas_horas").executar({ cidade: "Recife" }, d)

    expect(r).toMatchObject({
      status: "ok",
      cidade: "Recife",
      regiao: "PE",
      pais: "Brasil",
      fonte: FONTE_CLIMA,
      aviso: AVISO,
    })
    expect(r).toHaveProperty("temperatura")
    expect(r).toHaveProperty("chuva")
  })

  it("cidade não achada → cidade_nao_encontrada com aviso", async () => {
    const r = await publica("clima_agora").executar({ cidade: "Zzzzzz" }, deps())
    expect(r).toEqual({ status: "cidade_nao_encontrada", aviso: AVISO })
  })

  it("busca de cidade fora do ar → indisponivel com aviso", async () => {
    const d = deps()
    const cidades = createFakeCities()
    cidades.foraDoAr(true)
    const r = await publica("clima_agora").executar({ cidade: "Recife" }, { ...d, cidades })
    expect(r).toEqual({ status: "indisponivel", aviso: AVISO })
  })

  it("Open-Meteo fora do ar → indisponivel com aviso, nas duas tools", async () => {
    const d = deps()
    d.clima.foraDoAr(true)
    const agora = await publica("clima_agora").executar({ cidade: "Recife" }, d)
    const horas = await publica("clima_proximas_horas").executar({ cidade: "Recife" }, d)
    expect(agora).toEqual({ status: "indisponivel", aviso: AVISO })
    expect(horas).toEqual({ status: "indisponivel", aviso: AVISO })
  })

  it("entrada de cidade fora do limite é recusada pelo schema", async () => {
    const d = deps()
    await expect(publica("clima_agora").executar({ cidade: "a" }, d)).rejects.toThrow()
    await expect(publica("clima_agora").executar({ cidade: " Recife" }, d)).rejects.toThrow()
  })
})

describe("aviso em toda saída", () => {
  it("toda tool devolve aviso com o texto fixo", async () => {
    const d = deps()
    const saidas = [
      await publica("ayurveda_alimento").executar({ alimentos: ["banana"] }, d),
      await publica("ayurveda_candidatos").executar({ tipo: "pratica", buscadas: ["quente"] }, d),
      await publica("ayurveda_substitutos").executar({ alimento_id: "canela" }, d),
      await publica("ayurveda_checar_combinacao").executar({ itens: ["leite", "limao"] }, d),
      await publica("clima_agora").executar({ cidade: "Recife" }, d),
      await publica("clima_proximas_horas").executar({ cidade: "Recife" }, d),
    ]
    for (const s of saidas) expect(s).toMatchObject({ aviso: AVISO })
  })
})

describe("opcaoOk", () => {
  it("acha a opção ok mesmo fora da primeira posição", () => {
    const uniao = z.discriminatedUnion("status", [
      z.object({ status: z.literal("indisponivel") }),
      z.object({ status: z.literal("ok"), x: z.string() }),
    ])
    expect(Object.keys(opcaoOk(uniao).shape)).toEqual(["status", "x"])
  })

  it("lança se a união não tem a opção ok", () => {
    const uniao = z.discriminatedUnion("status", [
      z.object({ status: z.literal("indisponivel") }),
      z.object({ status: z.literal("sem_cidade") }),
    ])
    expect(() => opcaoOk(uniao)).toThrow("opção ok")
  })
})
