import { describe, expect, it } from "vitest"
import { z } from "zod"
import { type FiltroPessoa, filtroVazio } from "@/core/knowledge/filtros"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import type { ToolContext } from "@/core/tools/tool"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { casaLerTool, historicoRecenteTool, memoriaTools, preferenciasLerTool } from "./memoria"

const CONTA = "conta-1"
const DIA_EM_MS = 86_400_000
const MOMENTO = {
  estados: ["sem_energia" as const],
  momento_do_dia: "manha" as const,
  gunas_buscadas: ["quente" as const],
}

function ambiente(filtro: FiltroPessoa = filtroVazio) {
  const clock = createFixedClock("2026-01-15T12:00:00Z")
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
  return { ctx, clock, stores }
}

async function idDoItem(stores: ReturnType<typeof createMemoryStores>, alimentoId: string) {
  const itens = await stores.pantry.listar(CONTA)
  return itens.find((i) => i.alimento_id === alimentoId)?.id ?? ""
}

// Cria um run concluído, com ou sem momento, na hora atual do relógio.
async function runConcluido(
  stores: ReturnType<typeof createMemoryStores>,
  opts: { conta?: string; dia?: string; momento?: typeof MOMENTO | null } = {},
) {
  const conta = opts.conta ?? CONTA
  const run = await stores.runs.criar(conta, {
    caminho: "casa",
    intencoes: [],
    dia: opts.dia ?? "2026-01-15",
  })
  await stores.runs.atualizar(conta, run.id, {
    status: "done",
    momento: opts.momento === undefined ? MOMENTO : opts.momento,
  })
  return run
}

describe("memoriaTools", () => {
  it("exporta as três tools de leitura com os nomes do contrato", () => {
    expect(memoriaTools.map((t) => t.name)).toEqual([
      "casa.ler",
      "preferencias.ler",
      "historico.recente",
    ])
  })
})

describe("resumir das tools de memória", () => {
  it("casa.ler resume as contagens, sem nome de alimento", async () => {
    const { ctx, stores } = ambiente()
    await stores.pantry.registrar(
      CONTA,
      [{ alimento_id: "banana" }, { alimento_id: "canela" }],
      "conversa",
    )

    const r = await casaLerTool.execute({}, ctx)

    expect(casaLerTool.resumir?.(r)).toBe("2 confirmados, 0 incertos")
    expect(casaLerTool.resumir?.(r)).not.toMatch(/banana|canela/i)
  })

  it("preferencias.ler resume o número de registros, sem os ids", () => {
    const r = {
      itens: [
        {
          tipo: "alimento" as const,
          id: "banana",
          gosto: "gosta" as const,
          ajudou: 1,
          nao_ajudou: 0,
          nao_fez: 0,
        },
        {
          tipo: "pratica" as const,
          id: "caminhada",
          gosto: null,
          ajudou: 0,
          nao_ajudou: 1,
          nao_fez: 0,
        },
      ],
    }

    expect(preferenciasLerTool.resumir?.(r)).toBe("2 registros")
    expect(preferenciasLerTool.resumir?.(r)).not.toMatch(/banana|caminhada/)
  })

  it("historico.recente resume o número de dias, sem o título das sugestões", () => {
    const linha = {
      dia: "2026-01-14",
      momento_do_dia: "manha" as const,
      estados: ["sem_energia" as const],
      sugestoes: [{ titulo: "Chá de gengibre", resultado: "ajudou" as const }],
    }

    const r = { runs: [linha, { ...linha, dia: "2026-01-13" }, { ...linha, dia: "2026-01-12" }] }

    expect(historicoRecenteTool.resumir?.(r)).toBe("3 dias")
    expect(historicoRecenteTool.resumir?.(r)).not.toMatch(/gengibre/i)
  })

  it("historico.recente conta dias distintos: dois momentos no mesmo dia são um dia", () => {
    const linha = {
      dia: "2026-01-14",
      momento_do_dia: "manha" as const,
      estados: ["sem_energia" as const],
      sugestoes: [{ titulo: "Chá de gengibre", resultado: "ajudou" as const }],
    }

    const r = { runs: [linha, { ...linha, momento_do_dia: "tarde" as const }] }

    expect(historicoRecenteTool.resumir?.(r)).toBe("1 dias")
  })
})

describe("casa.ler", () => {
  it("traz um item incerto e um confirmado com as contagens certas, sem o que acabou", async () => {
    const { ctx, clock, stores } = ambiente()
    await stores.pantry.registrar(
      CONTA,
      [{ alimento_id: "banana" }, { alimento_id: "canela" }],
      "conversa",
    )
    await stores.pantry.registrar(CONTA, [{ alimento_id: "mel" }], "conversa")
    await stores.pantry.marcarAcabou(CONTA, [{ alimento_id: "mel" }])
    clock.advance(6 * DIA_EM_MS)

    const r = await casaLerTool.execute({}, ctx)

    expect(r).toEqual({
      itens: [
        {
          alimento_id: "canela",
          nome: "Canela",
          grupo: "especiarias",
          estado: "confirmado",
          dias_desde_confirmacao: 6,
          conhecido: true,
        },
        {
          alimento_id: "banana",
          nome: "Banana",
          grupo: "frutas",
          estado: "incerto",
          dias_desde_confirmacao: 6,
          conhecido: true,
        },
      ],
      confirmados: 1,
      incertos: 1,
    })
  })

  it("sempre_tenho conta como confirmado, mesmo muito tempo depois", async () => {
    const { ctx, clock, stores } = ambiente()
    await stores.pantry.registrar(CONTA, [{ alimento_id: "arroz-branco" }], "conversa")
    await stores.pantry.definirSempreTenho(CONTA, await idDoItem(stores, "arroz-branco"), true)
    clock.advance(400 * DIA_EM_MS)

    const r = await casaLerTool.execute({}, ctx)

    expect(r.itens).toMatchObject([{ alimento_id: "arroz-branco", estado: "sempre_tenho" }])
    expect(r).toMatchObject({ confirmados: 1, incertos: 0 })
  })

  it("um alimento do grupo em evitar sempre some", async () => {
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
    expect(r).toMatchObject({ confirmados: 1, incertos: 0 })
  })

  it("um nome livre some quando contém um texto que a pessoa pediu para evitar", async () => {
    const { ctx, stores } = ambiente({
      ...filtroVazio,
      evitar: [{ tipo: "texto", valor: "pimenta" }],
    })
    await stores.pantry.registrar(
      CONTA,
      [{ nome_livre: "Pimenta biquinho" }, { nome_livre: "pitaia" }],
      "conversa",
    )

    const r = await casaLerTool.execute({}, ctx)

    expect(r.itens.map((i) => i.nome)).toEqual(["pitaia"])
  })

  it("um nome livre aparece com conhecido: false e grupo nulo", async () => {
    const { ctx, stores } = ambiente()
    await stores.pantry.registrar(CONTA, [{ nome_livre: "pitaia" }], "conversa")

    const r = await casaLerTool.execute({}, ctx)

    expect(r.itens).toEqual([
      {
        alimento_id: null,
        nome: "pitaia",
        grupo: null,
        estado: "confirmado",
        dias_desde_confirmacao: 0,
        conhecido: false,
      },
    ])
  })

  it("ordena por grupo, com nulos no fim, e depois por nome", async () => {
    const { ctx, stores } = ambiente()
    await stores.pantry.registrar(
      CONTA,
      [
        { nome_livre: "pitaia" },
        { alimento_id: "limao" },
        { alimento_id: "banana" },
        { alimento_id: "canela" },
      ],
      "conversa",
    )

    const r = await casaLerTool.execute({}, ctx)

    expect(r.itens.map((i) => i.nome)).toEqual(["Canela", "Banana", "Limão", "pitaia"])
  })

  it("rejeita entrada com campos a mais", () => {
    expect(() => casaLerTool.input.parse({ conta_id: "outra" })).toThrow(z.ZodError)
  })
})

describe("preferencias.ler", () => {
  it("devolve só os itens que têm registro", async () => {
    const { ctx, stores } = ambiente()
    await stores.preferences.definirGosto(CONTA, { tipo: "alimento", id: "banana" }, "gosta")
    await stores.preferences.contarResultado(CONTA, { tipo: "alimento", id: "banana" }, "ajudou")

    const r = await preferenciasLerTool.execute(
      {
        itens: [
          { tipo: "alimento", id: "banana" },
          { tipo: "alimento", id: "canela" },
        ],
      },
      ctx,
    )

    expect(r).toEqual({
      itens: [
        {
          tipo: "alimento",
          id: "banana",
          gosto: "gosta",
          ajudou: 1,
          nao_ajudou: 0,
          nao_fez: 0,
        },
      ],
    })
  })

  it("aceita de 1 a 10 itens", async () => {
    const { ctx } = ambiente()
    const um = { tipo: "alimento" as const, id: "banana" }
    const onze = Array.from({ length: 11 }, () => um)

    await expect(preferenciasLerTool.execute({ itens: [] }, ctx)).rejects.toBeInstanceOf(z.ZodError)
    await expect(preferenciasLerTool.execute({ itens: onze }, ctx)).rejects.toBeInstanceOf(
      z.ZodError,
    )
  })
})

describe("historico.recente", () => {
  it("traz no máximo 20 runs dos últimos 7 dias", async () => {
    const { ctx, clock, stores } = ambiente()
    await runConcluido(stores)
    clock.advance(8 * DIA_EM_MS)
    for (let i = 0; i < 25; i++) await runConcluido(stores)

    const r = await historicoRecenteTool.execute({}, ctx)

    expect(r.runs).toHaveLength(20)
  })

  it("traz dia, momento_do_dia, estados e as sugestões com resultado", async () => {
    const { ctx, stores } = ambiente()
    const run = await runConcluido(stores)
    const [, respondido] = await stores.outcomes.criar(CONTA, run.id, [
      { tipo: "cha", alimentos: ["canela"], titulo: "Chá de canela" },
      { tipo: "cha", alimentos: ["gengibre"], titulo: "Chá de gengibre" },
    ])
    await stores.outcomes.responder(CONTA, respondido?.id ?? "", "ajudou", "toque")

    const r = await historicoRecenteTool.execute({ dias: 7 }, ctx)

    expect(r.runs).toEqual([
      {
        dia: "2026-01-15",
        momento_do_dia: "manha",
        estados: ["sem_energia"],
        sugestoes: [
          { titulo: "Chá de canela", resultado: "aguardando" },
          { titulo: "Chá de gengibre", resultado: "ajudou" },
        ],
      },
    ])
  })

  it("run sem momento é ignorado", async () => {
    const { ctx, stores } = ambiente()
    await runConcluido(stores, { momento: null })
    await runConcluido(stores)

    const r = await historicoRecenteTool.execute({}, ctx)

    expect(r.runs).toHaveLength(1)
  })

  it("a saída não tem texto nem o que a pessoa escreveu", async () => {
    const { ctx, stores } = ambiente()
    const run = await runConcluido(stores)
    await stores.messages.gravar(CONTA, {
      run_id: run.id,
      autor: "pessoa",
      texto: "Estou com dor de cabeça forte desde ontem",
      com_incomodo: true,
      dia: "2026-01-15",
    })

    const r = await historicoRecenteTool.execute({}, ctx)
    const json = JSON.stringify(r)

    expect(json).not.toContain("dor de cabeça")
    expect(json).not.toContain('"texto"')
  })

  it("uma conta não vê o histórico de outra", async () => {
    const { ctx, stores } = ambiente()
    await runConcluido(stores, { conta: "conta-2" })

    const r = await historicoRecenteTool.execute({}, ctx)

    expect(r.runs).toEqual([])
  })

  it("aceita de 1 a 7 dias", async () => {
    const { ctx } = ambiente()

    await expect(historicoRecenteTool.execute({ dias: 0 }, ctx)).rejects.toBeInstanceOf(z.ZodError)
    await expect(historicoRecenteTool.execute({ dias: 8 }, ctx)).rejects.toBeInstanceOf(z.ZodError)
  })
})
