import { describe, expect, it } from "vitest"
import { RituError } from "@/core/errors"
import { createTouches } from "@/core/touches"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"

function montar() {
  const clock = createFixedClock("2026-05-10T12:00:00Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const touches = createTouches({
    tx: stores,
    stores,
    kb: createMiniKnowledge(),
    clock,
    telemetry,
  })
  return { stores, telemetry, touches }
}

async function erroDe(promessa: Promise<unknown>): Promise<unknown> {
  try {
    await promessa
  } catch (erro) {
    return erro
  }
  throw new Error("deveria ter lançado")
}

describe("createTouches", () => {
  it("expõe os cinco toques", () => {
    const { touches } = montar()
    expect(Object.keys(touches).sort()).toEqual([
      "responderTroca",
      "tocarGosto",
      "tocarRetorno",
      "tocarVoto",
      "trocarIngrediente",
    ])
  })

  it("tocarVoto chega ao domínio com as deps do container (grava e soma a métrica)", async () => {
    const { stores, telemetry, touches } = montar()
    const run = await stores.runs.criar("c1", {
      caminho: "acompanhante",
      intencoes: [],
      dia: "2026-05-10",
    })
    await stores.runs.atualizar("c1", run.id, { saida: { texto: "ok" } })
    await touches.tocarVoto("c1", run.id, "down")
    const metricas = telemetry.metricas.filter((m) => m.nome === "ritu_feedback_total")
    expect(metricas).toHaveLength(1)
    expect(metricas[0]).toMatchObject({ rotulos: { voto: "down" } })
  })

  it("tocarGosto chega ao domínio com as deps do container (grava e soma a métrica)", async () => {
    const { stores, telemetry, touches } = montar()
    await touches.tocarGosto("c1", { tipo: "alimento", id: "gengibre" }, "gosta")
    const pref = (await stores.preferences.ler("c1", [{ tipo: "alimento", id: "gengibre" }]))[0]
    expect(pref?.gosto).toBe("gosta")
    const metricas = telemetry.metricas.filter((m) => m.nome === "ritu_gosto_total")
    expect(metricas).toHaveLength(1)
    expect(metricas[0]).toMatchObject({ rotulos: { gosto: "gosta" } })
  })

  it("tocarGosto com item fora da base usa o kb do container e lança toque_invalido", async () => {
    const { stores, touches } = montar()
    const erro = await erroDe(
      touches.tocarGosto("c1", { tipo: "alimento", id: "nao-existe" }, "gosta"),
    )
    expect(erro).toBeInstanceOf(RituError)
    expect(erro).toMatchObject({ code: "toque_invalido", message: "Toque inválido" })
    const pref = (await stores.preferences.ler("c1", [{ tipo: "alimento", id: "nao-existe" }]))[0]
    expect(pref).toBeUndefined()
  })

  it("tocarRetorno fecha o retorno aguardando e soma ritu_retorno_total", async () => {
    const { stores, telemetry, touches } = montar()
    const run = await stores.runs.criar("c1", {
      caminho: "acompanhante",
      intencoes: [],
      dia: "2026-05-10",
    })
    const [retorno] = await stores.outcomes.criar("c1", run.id, [
      {
        tipo: "cha",
        pratica_id: "cha-gengibre",
        alimentos: ["gengibre"],
        titulo: "Chá de gengibre",
      },
    ])
    if (!retorno) throw new Error("retorno não criado")
    const fechado = await touches.tocarRetorno("c1", retorno.id, "ajudou")
    expect(fechado).toMatchObject({ id: retorno.id, status: "respondido", resultado: "ajudou" })
    const metricas = telemetry.metricas.filter((m) => m.nome === "ritu_retorno_total")
    expect(metricas).toHaveLength(1)
    expect(metricas[0]).toMatchObject({ rotulos: { resultado: "ajudou", origem: "toque" } })
  })

  it("tocarRetorno com retorno inexistente lança toque_invalido e não soma métrica", async () => {
    const { telemetry, touches } = montar()
    const erro = await erroDe(touches.tocarRetorno("c1", "nao-existe", "ajudou"))
    expect(erro).toMatchObject({ code: "toque_invalido", message: "Toque inválido" })
    expect(telemetry.metricas.filter((m) => m.nome === "ritu_retorno_total")).toHaveLength(0)
  })

  it("trocarIngrediente com run inexistente lança toque_invalido e não soma métrica", async () => {
    const { telemetry, touches } = montar()
    const erro = await erroDe(
      touches.trocarIngrediente("c1", {
        runId: "nao-existe",
        sugestao: 0,
        alimento_id: "gengibre",
        motivo: "trocar",
      }),
    )
    expect(erro).toMatchObject({ code: "toque_invalido", message: "Toque inválido" })
    expect(
      telemetry.metricas.filter((m) => m.nome === "ritu_troca_ingrediente_total"),
    ).toHaveLength(0)
  })

  it("responderTroca com run inexistente lança toque_invalido e não soma métrica", async () => {
    const { telemetry, touches } = montar()
    const erro = await erroDe(
      touches.responderTroca("c1", {
        runId: "nao-existe",
        sugestao: 0,
        alimento_id: "gengibre",
        candidato: "canela",
        resposta: "nao_tenho",
      }),
    )
    expect(erro).toMatchObject({ code: "toque_invalido", message: "Toque inválido" })
    expect(telemetry.metricas.filter((m) => m.nome === "ritu_faltas_total")).toHaveLength(0)
  })
})
