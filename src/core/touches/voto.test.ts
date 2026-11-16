import { describe, expect, it } from "vitest"
import { RituError } from "@/core/errors"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import type { Deps } from "./deps"
import { tocarVoto } from "./voto"

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

/** Cria um run da conta com saída, que é o que o voto exige. */
async function runComSaida(stores: ReturnType<typeof montar>["stores"], contaId: string) {
  const run = await stores.runs.criar(contaId, {
    caminho: "acompanhante",
    intencoes: [],
    dia: "2026-05-10",
  })
  await stores.runs.atualizar(contaId, run.id, { saida: { texto: "ok" } })
  return run
}

const metricasDeVoto = (telemetry: ReturnType<typeof montar>["telemetry"]) =>
  telemetry.metricas.filter((m) => m.nome === "ritu_feedback_total")

describe("tocarVoto", () => {
  it("voto novo soma 1 com o voto", async () => {
    const { stores, telemetry, deps } = montar()
    const run = await runComSaida(stores, "c1")
    await tocarVoto(deps, "c1", run.id, "up")
    expect(metricasDeVoto(telemetry)).toHaveLength(1)
    expect(metricasDeVoto(telemetry)[0]).toMatchObject({ valor: 1, rotulos: { voto: "up" } })
  })

  it("voto mudado soma com o novo voto", async () => {
    const { stores, telemetry, deps } = montar()
    const run = await runComSaida(stores, "c1")
    await tocarVoto(deps, "c1", run.id, "up")
    await tocarVoto(deps, "c1", run.id, "down")
    expect(metricasDeVoto(telemetry)).toHaveLength(2)
    expect(metricasDeVoto(telemetry)[1]).toMatchObject({ rotulos: { voto: "down" } })
  })

  it("o mesmo voto de novo não soma", async () => {
    const { stores, telemetry, deps } = montar()
    const run = await runComSaida(stores, "c1")
    await tocarVoto(deps, "c1", run.id, "up")
    await tocarVoto(deps, "c1", run.id, "up")
    expect(metricasDeVoto(telemetry)).toHaveLength(1)
  })

  it("run de outra conta lança toque_invalido e não soma", async () => {
    const { stores, telemetry, deps } = montar()
    const run = await runComSaida(stores, "c2")
    const erro = await erroDe(tocarVoto(deps, "c1", run.id, "up"))
    expect(erro).toBeInstanceOf(RituError)
    expect(erro).toMatchObject({ code: "toque_invalido", message: "Toque inválido" })
    expect(metricasDeVoto(telemetry)).toHaveLength(0)
  })

  it("run inexistente lança toque_invalido e não soma", async () => {
    const { telemetry, deps } = montar()
    const erro = await erroDe(tocarVoto(deps, "c1", "nao-existe", "down"))
    expect(erro).toMatchObject({ code: "toque_invalido", message: "Toque inválido" })
    expect(metricasDeVoto(telemetry)).toHaveLength(0)
  })

  it("run sem saída lança toque_invalido e não soma", async () => {
    const { stores, telemetry, deps } = montar()
    const run = await stores.runs.criar("c1", {
      caminho: "acompanhante",
      intencoes: [],
      dia: "2026-05-10",
    })
    const erro = await erroDe(tocarVoto(deps, "c1", run.id, "up"))
    expect(erro).toMatchObject({ code: "toque_invalido", message: "Toque inválido" })
    expect(metricasDeVoto(telemetry)).toHaveLength(0)
  })

  it("o span toque sai com tipo voto e sem o id do run", async () => {
    const { stores, telemetry, deps } = montar()
    const run = await runComSaida(stores, "c1")
    await tocarVoto(deps, "c1", run.id, "up")
    const span = telemetry.spans.find((s) => s.nome === "toque")
    expect(span?.atributos).toEqual({ tipo: "voto" })
    expect(JSON.stringify(span?.atributos)).not.toMatch(new RegExp(run.id))
  })
})
