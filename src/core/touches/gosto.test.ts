import { describe, expect, it } from "vitest"
import { RituError } from "@/core/errors"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import type { Deps } from "./deps"
import { tocarGosto } from "./gosto"

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

const metricasDeGosto = (telemetry: ReturnType<typeof montar>["telemetry"]) =>
  telemetry.metricas.filter((m) => m.nome === "ritu_gosto_total")

describe("tocarGosto", () => {
  it("gosta grava e soma ritu_gosto_total com gosta", async () => {
    const { stores, telemetry, deps } = montar()
    await tocarGosto(deps, "c1", { tipo: "alimento", id: "gengibre" }, "gosta")
    const pref = (await stores.preferences.ler("c1", [{ tipo: "alimento", id: "gengibre" }]))[0]
    expect(pref?.gosto).toBe("gosta")
    expect(metricasDeGosto(telemetry)).toHaveLength(1)
    expect(metricasDeGosto(telemetry)[0]).toMatchObject({ valor: 1, rotulos: { gosto: "gosta" } })
  })

  it("nao_gosta grava e soma com nao_gosta", async () => {
    const { stores, telemetry, deps } = montar()
    await tocarGosto(deps, "c1", { tipo: "alimento", id: "canela" }, "nao_gosta")
    const pref = (await stores.preferences.ler("c1", [{ tipo: "alimento", id: "canela" }]))[0]
    expect(pref?.gosto).toBe("nao_gosta")
    expect(metricasDeGosto(telemetry)[0]).toMatchObject({ rotulos: { gosto: "nao_gosta" } })
  })

  it("null limpa o gosto e soma com limpou", async () => {
    const { stores, telemetry, deps } = montar()
    const item = { tipo: "alimento" as const, id: "gengibre" }
    await tocarGosto(deps, "c1", item, "gosta")
    await tocarGosto(deps, "c1", item, null)
    const pref = (await stores.preferences.ler("c1", [item]))[0]
    expect(pref?.gosto).toBeNull()
    expect(metricasDeGosto(telemetry)).toHaveLength(2)
    expect(metricasDeGosto(telemetry)[1]).toMatchObject({ rotulos: { gosto: "limpou" } })
  })

  it("aceita preparo e prática da base", async () => {
    const { stores, deps } = montar()
    await tocarGosto(deps, "c1", { tipo: "preparo", id: "mingau" }, "gosta")
    await tocarGosto(deps, "c1", { tipo: "pratica", id: "respiracao-lenta" }, "nao_gosta")
    const prefs = await stores.preferences.ler("c1")
    expect(prefs).toContainEqual(
      expect.objectContaining({ item_tipo: "preparo", item_id: "mingau", gosto: "gosta" }),
    )
    expect(prefs).toContainEqual(
      expect.objectContaining({
        item_tipo: "pratica",
        item_id: "respiracao-lenta",
        gosto: "nao_gosta",
      }),
    )
  })

  it.each([
    ["alimento inexistente", { tipo: "alimento" as const, id: "nao-existe" }],
    ["preparo inexistente", { tipo: "preparo" as const, id: "nao-existe" }],
    ["id de prática passado como preparo", { tipo: "preparo" as const, id: "cha-gengibre" }],
    ["prática inexistente", { tipo: "pratica" as const, id: "nao-existe" }],
    ["id de preparo passado como alimento", { tipo: "alimento" as const, id: "mingau" }],
  ])("item fora da base (%s) é toque_invalido e nada é gravado", async (_, item) => {
    const { stores, telemetry, deps } = montar()
    const erro = await erroDe(tocarGosto(deps, "c1", item, "gosta"))
    expect(erro).toBeInstanceOf(RituError)
    expect(erro).toMatchObject({ code: "toque_invalido", message: "Toque inválido" })
    expect(await stores.preferences.ler("c1")).toEqual([])
    expect(metricasDeGosto(telemetry)).toHaveLength(0)
  })

  it("o span toque sai com tipo gosto e sem nome de alimento", async () => {
    const { telemetry, deps } = montar()
    await tocarGosto(deps, "c1", { tipo: "alimento", id: "gengibre" }, "gosta")
    const span = telemetry.spans.find((s) => s.nome === "toque")
    expect(span?.atributos).toEqual({ tipo: "gosto" })
    expect(JSON.stringify(span?.atributos)).not.toMatch(/gengibre/)
  })
})
