import { describe, expect, it } from "vitest"
import { type FiltroPessoa, filtroVazio } from "@/core/knowledge/filtros"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import type { SugestaoRegistrada } from "@/core/memory-schemas"
import type { ContextoDoRun, ToolContext } from "@/core/tools/tool"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { resultadoRegistrar } from "./resultado"

const CONTA = "conta-1"
const SUGESTAO: SugestaoRegistrada = {
  tipo: "cha",
  preparo_id: "cha-gengibre",
  alimentos: ["gengibre"],
  titulo: "Chá de gengibre",
}

async function ambiente(opts: { retorno?: ContextoDoRun["retorno"]; semTx?: boolean } = {}) {
  const clock = createFixedClock("2026-01-15T12:00:00Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const [criado] = await stores.outcomes.criar(CONTA, "run-1", [SUGESTAO])
  if (!criado) throw new Error("retorno não criado")
  const run: ContextoDoRun = {
    com_incomodo: false,
    tem_para_ter: false,
    nao_tem: [],
    candidatos: [],
    na_lista: [],
    lista_recusada: [],
    notas_ativas: [],
    pendentes: [{ n: 1, retorno_id: criado.id }],
    ...(opts.retorno ? { retorno: opts.retorno } : {}),
  }
  const ctx: ToolContext = {
    kb: createMiniKnowledge(),
    filtro: filtroVazio as FiltroPessoa,
    sinais: sinaisVazios,
    clima: { fonte: createFakeWeather() },
    contaId: CONTA,
    stores,
    clock,
    telemetry,
    run,
    ...(opts.semTx ? {} : { tx: stores }),
  }
  return { ctx, stores, telemetry, retornoId: criado.id }
}

const ajudouNoRun = () => ({ resultado: "ajudou" as const, registrado: false })

async function ajudou(stores: Awaited<ReturnType<typeof ambiente>>["stores"]) {
  return (await stores.preferences.ler(CONTA, [{ tipo: "preparo", id: "cha-gengibre" }]))[0]?.ajudou
}

describe("resultado.registrar", () => {
  it("aceita: grava o resultado do run com origem conversa e devolve o título", async () => {
    const { ctx, stores } = await ambiente({ retorno: ajudouNoRun() })
    const r = await resultadoRegistrar.execute({ pendente: 1 }, ctx)
    expect(r).toEqual({ registrado: true, titulo: "Chá de gengibre" })
    expect(ctx.run?.retorno?.registrado).toBe(true)
    expect(await stores.outcomes.pendentes(CONTA)).toHaveLength(0)
    const [retorno] = await stores.outcomes.doRun(CONTA, "run-1")
    expect(retorno).toMatchObject({ resultado: "ajudou", origem: "conversa" })
    expect(await ajudou(stores)).toBe(1)
  })

  it("o resultado gravado é o do run, nunca um vindo da entrada", async () => {
    const { ctx, stores } = await ambiente({
      retorno: { resultado: "nao_ajudou", registrado: false },
    })
    await resultadoRegistrar.execute({ pendente: 1, resultado: "ajudou" } as never, ctx)
    const [retorno] = await stores.outcomes.doRun(CONTA, "run-1")
    expect(retorno?.resultado).toBe("nao_ajudou")
  })

  it("sem_retorno quando o run não tem retorno", async () => {
    const { ctx } = await ambiente()
    expect(await resultadoRegistrar.execute({ pendente: 1 }, ctx)).toEqual({
      registrado: false,
      motivo: "sem_retorno",
    })
  })

  it("ja_registrado quando o retorno já está marcado", async () => {
    const { ctx } = await ambiente({ retorno: { resultado: "ajudou", registrado: true } })
    expect(await resultadoRegistrar.execute({ pendente: 1 }, ctx)).toEqual({
      registrado: false,
      motivo: "ja_registrado",
    })
  })

  it("fora_dos_pendentes quando o número não existe", async () => {
    const { ctx } = await ambiente({ retorno: ajudouNoRun() })
    expect(await resultadoRegistrar.execute({ pendente: 7 }, ctx)).toEqual({
      registrado: false,
      motivo: "fora_dos_pendentes",
    })
  })

  it("duas chamadas no mesmo run: a segunda é ja_registrado e a contagem soma uma vez", async () => {
    const { ctx, stores } = await ambiente({ retorno: ajudouNoRun() })
    await resultadoRegistrar.execute({ pendente: 1 }, ctx)
    expect(await resultadoRegistrar.execute({ pendente: 1 }, ctx)).toEqual({
      registrado: false,
      motivo: "ja_registrado",
    })
    expect(await ajudou(stores)).toBe(1)
  })

  it("retorno fechado por toque antes: ja_registrado, sem somar de novo", async () => {
    const { ctx, stores, retornoId } = await ambiente({ retorno: ajudouNoRun() })
    await stores.outcomes.responder(CONTA, retornoId, "nao_fez", "toque")
    expect(await resultadoRegistrar.execute({ pendente: 1 }, ctx)).toEqual({
      registrado: false,
      motivo: "ja_registrado",
    })
    expect(await ajudou(stores)).toBeUndefined()
  })

  it("sem transação, lança", async () => {
    const { ctx } = await ambiente({ retorno: ajudouNoRun(), semTx: true })
    await expect(resultadoRegistrar.execute({ pendente: 1 }, ctx)).rejects.toThrow(
      "resultado.registrar sem transação",
    )
  })

  it("resumir não leva título", () => {
    expect(resultadoRegistrar.resumir?.({ registrado: true, titulo: "Chá de gengibre" })).toBe(
      "registrado",
    )
    expect(resultadoRegistrar.resumir?.({ registrado: false, motivo: "sem_retorno" })).toBe(
      "recusado: sem_retorno",
    )
  })
})
