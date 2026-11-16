import { describe, expect, it } from "vitest"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { contextoDoRun } from "./contexto-do-run"
import type { EntradaDoAcompanhante } from "./entrada"
import { preparar } from "./preparo"

const CONTA = "conta-1"
const HOJE = "2026-11-15"
const kb = createMiniKnowledge()

function montar() {
  const clock = createFixedClock("2026-11-15T18:00:00.000Z")
  const stores = createMemoryStores(clock)
  const deps = { stores, kb, clock, telemetry: createMemoryTelemetry() }
  return {
    stores,
    run: (e: Partial<EntradaDoAcompanhante> = {}) =>
      preparar(deps, CONTA, {
        intencoes: ["momento"],
        estados: ["com_frio"],
        evitar_da_mensagem: [],
        ...e,
      }),
  }
}

describe("contextoDoRun", () => {
  it("sem fato, incômodo nem para_ter, leva as listas do preparo e nada de fato", async () => {
    const { run } = montar()
    const dados = await run()
    expect(contextoDoRun(dados)).toEqual({
      com_incomodo: false,
      tem_para_ter: false,
      nao_tem: [],
      candidatos: dados.candidatos_do_preparo,
      na_lista: [],
      lista_recusada: [],
      notas_ativas: [],
      pendentes: [],
    })
    expect(contextoDoRun(dados).fato_de_rotina).toBeUndefined()
  })

  it("com fato de rotina, leva o fato e tem_para_ter quando o preparo trouxe para_ter", async () => {
    const { run, stores } = montar()
    const falta = [{ alimento_id: "gengibre", origem: "nao_tenho" as const }]
    await stores.shortages.registrar(CONTA, falta, "2026-11-13")
    await stores.shortages.registrar(CONTA, falta, "2026-11-14")
    await stores.shortages.registrar(CONTA, falta, HOJE)
    const dados = await run({ fato_de_rotina: "trabalho à noite" })
    const ctx = contextoDoRun(dados)
    expect(ctx.fato_de_rotina).toBe("trabalho à noite")
    expect(ctx.tem_para_ter).toBe(true)
  })

  it("com incômodo, marca com_incomodo e não leva para_ter", async () => {
    const { run } = montar()
    const dados = await run({ incomodo: { id: "gases", variante: "unica" } })
    const ctx = contextoDoRun(dados)
    expect(ctx.com_incomodo).toBe(true)
    expect(ctx.tem_para_ter).toBe(false)
  })

  it("nao_tem vem de nao_tem_do_run e as listas de cada campo do preparo", async () => {
    const { run } = montar()
    const dados = await run()
    const ctx = contextoDoRun({
      ...dados,
      nao_tem_do_run: ["gengibre"],
      na_lista: ["canela"],
      lista_recusada: ["cravo"],
      notas_ativas: ["trabalho noturno"],
    })
    expect(ctx.nao_tem).toEqual(["gengibre"])
    expect(ctx.na_lista).toEqual(["canela"])
    expect(ctx.lista_recusada).toEqual(["cravo"])
    expect(ctx.notas_ativas).toEqual(["trabalho noturno"])
  })

  it("sempre leva pendentes; leva retorno só quando a entrada trouxe", async () => {
    const { run } = montar()
    const sem = contextoDoRun(await run())
    expect(sem.pendentes).toEqual([])
    expect(sem.retorno).toBeUndefined()
    const base = await run({ retorno: { resultado: "ajudou", registrado: false } })
    const dados = {
      ...base,
      retorno: { resultado: "ajudou" as const, titulo: "x", registrado: false },
      retornos_pendentes: [
        { n: 1, retorno_id: "r-1", tipo: "cha" as const, titulo: "Chá", ha_dias: 0 },
      ],
    }
    const ctx = contextoDoRun(dados)
    expect(ctx.retorno).toEqual({ resultado: "ajudou", registrado: false })
    expect(ctx.pendentes).toEqual([{ n: 1, retorno_id: "r-1" }])
  })
})
