import { describe, expect, it } from "vitest"
import { RituError } from "@/core/errors"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import type { Deps } from "./deps"
import { acaoDaListaSchema, tocarLista } from "./lista"

function montar() {
  const clock = createFixedClock("2026-05-10T12:00:00Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const deps: Deps = { tx: stores, stores, kb: createMiniKnowledge(), clock, telemetry }
  return { stores, telemetry, deps }
}

async function erroDe(promessa: Promise<unknown>): Promise<unknown> {
  try {
    await promessa
  } catch (erro) {
    return erro
  }
  throw new Error("deveria ter lançado")
}

describe("acaoDaListaSchema", () => {
  it("aceita por e tirar e recusa outras ações", () => {
    expect(acaoDaListaSchema.safeParse({ acao: "por", alimento_id: "leite" }).success).toBe(true)
    expect(acaoDaListaSchema.safeParse({ acao: "tirar", alimento_id: "leite" }).success).toBe(true)
    expect(acaoDaListaSchema.safeParse({ acao: "outra", alimento_id: "leite" }).success).toBe(false)
  })
})

describe("tocarLista", () => {
  it("por põe o alimento na lista com motivo pessoa e devolve o nome da base", async () => {
    const { stores, telemetry, deps } = montar()
    const r = await tocarLista(deps, "c1", { acao: "por", alimento_id: "leite" })
    expect(r).toEqual({ nome: "Leite" })
    const linha = (await stores.shortages.lista("c1"))[0]
    expect(linha).toMatchObject({ alimento_id: "leite", motivo: "pessoa", detalhe: "" })
    const span = telemetry.spans.find((s) => s.nome === "toque")
    expect(span?.atributos).toEqual({ tipo: "lista" })
  })

  it("por com alimento fora da base recusa com toque_invalido", async () => {
    const { stores, deps } = montar()
    const erro = await erroDe(tocarLista(deps, "c1", { acao: "por", alimento_id: "nao-existe" }))
    expect(erro).toBeInstanceOf(RituError)
    expect(erro).toMatchObject({ code: "toque_invalido", message: "Toque inválido" })
    expect(await stores.shortages.lista("c1")).toHaveLength(0)
  })

  it("por é idempotente e preserva o motivo anterior", async () => {
    const { stores, deps } = montar()
    await stores.shortages.porNaLista("c1", {
      alimento_id: "leite",
      motivo: "fez_falta",
      detalhe: "",
    })
    await tocarLista(deps, "c1", { acao: "por", alimento_id: "leite" })
    const lista = await stores.shortages.lista("c1")
    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({ motivo: "fez_falta" })
  })

  it("por não grava falta no dia", async () => {
    const { stores, deps } = montar()
    await tocarLista(deps, "c1", { acao: "por", alimento_id: "leite" })
    expect(await stores.shortages.diasComFalta("c1", "2026-01-01")).toEqual([])
  })

  it("tirar apaga a linha da lista e as faltas do alimento", async () => {
    const { stores, deps } = montar()
    await stores.shortages.registrar(
      "c1",
      [{ alimento_id: "leite", origem: "nao_tenho" }],
      "2026-05-10",
    )
    await stores.shortages.porNaLista("c1", {
      alimento_id: "leite",
      motivo: "pessoa",
      detalhe: "",
    })
    const r = await tocarLista(deps, "c1", { acao: "tirar", alimento_id: "leite" })
    expect(r).toEqual({ nome: "Leite" })
    expect(await stores.shortages.lista("c1")).toHaveLength(0)
    expect(await stores.shortages.diasComFalta("c1", "2026-01-01")).toEqual([])
  })

  it("span toque leva só { tipo: 'lista' }", async () => {
    const { telemetry, deps } = montar()
    await tocarLista(deps, "c1", { acao: "por", alimento_id: "banana" })
    const span = telemetry.spans.find((s) => s.nome === "toque")
    expect(span?.atributos).toEqual({ tipo: "lista" })
  })
})
