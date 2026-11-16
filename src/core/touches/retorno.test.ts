import { describe, expect, it } from "vitest"
import { RituError } from "@/core/errors"
import type { SugestaoRegistrada } from "@/core/memory-schemas"
import { registrarResultado } from "@/core/outcomes/registrar"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import type { Deps } from "./deps"
import { tocarRetorno } from "./retorno"

function montar() {
  const clock = createFixedClock("2026-05-10T12:00:00Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const deps: Deps = { tx: stores, stores, kb: createMiniKnowledge(), clock, telemetry }
  return { stores, telemetry, deps }
}

const cha: SugestaoRegistrada = {
  tipo: "cha",
  pratica_id: "cha-gengibre",
  alimentos: ["gengibre", "canela"],
  titulo: "Chá de gengibre",
}

async function criar(stores: ReturnType<typeof montar>["stores"], conta: string) {
  const [r] = await stores.outcomes.criar(conta, "run1", [cha])
  if (!r) throw new Error("retorno não criado")
  return r
}

async function pref(
  stores: ReturnType<typeof montar>["stores"],
  tipo: "alimento" | "pratica",
  id: string,
) {
  return (await stores.preferences.ler("c1", [{ tipo, id }]))[0]
}

async function erroDe(promessa: Promise<unknown>): Promise<unknown> {
  try {
    await promessa
  } catch (erro) {
    return erro
  }
  throw new Error("deveria ter lançado")
}

describe("tocarRetorno", () => {
  it("fecha com origem toque e soma o item e os alimentos", async () => {
    const { stores, telemetry, deps } = montar()
    const r = await criar(stores, "c1")
    const res = await tocarRetorno(deps, "c1", r.id, "ajudou")
    expect(res).toMatchObject({ status: "respondido", resultado: "ajudou", origem: "toque" })
    expect((await pref(stores, "pratica", "cha-gengibre"))?.ajudou).toBe(1)
    expect((await pref(stores, "alimento", "gengibre"))?.ajudou).toBe(1)
    expect((await pref(stores, "alimento", "canela"))?.ajudou).toBe(1)
    const metricas = telemetry.metricas.filter((m) => m.nome === "ritu_retorno_total")
    expect(metricas).toHaveLength(1)
    expect(metricas[0]).toMatchObject({
      valor: 1,
      rotulos: { resultado: "ajudou", origem: "toque" },
    })
  })

  it("tocar de novo devolve o retorno como está, sem somar outra vez", async () => {
    const { stores, telemetry, deps } = montar()
    const r = await criar(stores, "c1")
    await tocarRetorno(deps, "c1", r.id, "ajudou")
    const segundo = await tocarRetorno(deps, "c1", r.id, "nao_ajudou")
    expect(segundo).toMatchObject({ resultado: "ajudou", origem: "toque" })
    expect((await pref(stores, "pratica", "cha-gengibre"))?.ajudou).toBe(1)
    expect((await pref(stores, "pratica", "cha-gengibre"))?.nao_ajudou).toBe(0)
    expect(telemetry.metricas.filter((m) => m.nome === "ritu_retorno_total")).toHaveLength(1)
  })

  it("retorno fechado pela conversa e depois tocado devolve como está", async () => {
    const { stores, telemetry, deps } = montar()
    const r = await criar(stores, "c1")
    await registrarResultado({ tx: stores, telemetry }, "c1", r.id, "ajudou", "conversa")
    const res = await tocarRetorno(deps, "c1", r.id, "nao_ajudou")
    expect(res).toMatchObject({ resultado: "ajudou", origem: "conversa" })
    expect((await pref(stores, "pratica", "cha-gengibre"))?.ajudou).toBe(1)
    expect((await pref(stores, "pratica", "cha-gengibre"))?.nao_ajudou).toBe(0)
    expect(telemetry.metricas.filter((m) => m.nome === "ritu_retorno_total")).toHaveLength(1)
  })

  it("retorno inexistente ou de outra conta é toque_invalido e nada muda", async () => {
    const { stores, deps } = montar()
    const r = await criar(stores, "c1")
    const inexistente = await erroDe(tocarRetorno(deps, "c1", "nao-existe", "ajudou"))
    expect(inexistente).toBeInstanceOf(RituError)
    expect(inexistente).toMatchObject({ code: "toque_invalido", message: "Toque inválido" })
    const outraConta = await erroDe(tocarRetorno(deps, "c2", r.id, "ajudou"))
    expect(outraConta).toMatchObject({ code: "toque_invalido", message: "Toque inválido" })
    expect(await stores.outcomes.pendentes("c1")).toHaveLength(1)
    expect((await pref(stores, "pratica", "cha-gengibre"))?.ajudou ?? 0).toBe(0)
  })

  it("retorno apagado pela limpeza é toque_invalido", async () => {
    const { stores, deps } = montar()
    const r = await criar(stores, "c1")
    await stores.outcomes.apagarAguardandoAntesDe(new Date("2026-06-01T00:00:00Z"))
    const erro = await erroDe(tocarRetorno(deps, "c1", r.id, "ajudou"))
    expect(erro).toMatchObject({ code: "toque_invalido", message: "Toque inválido" })
  })

  it("o span toque sai com tipo retorno e sem nome de alimento", async () => {
    const { stores, telemetry, deps } = montar()
    const r = await criar(stores, "c1")
    await tocarRetorno(deps, "c1", r.id, "ajudou")
    const span = telemetry.spans.find((s) => s.nome === "toque")
    expect(span?.atributos).toEqual({ tipo: "retorno" })
    expect(JSON.stringify(span?.atributos)).not.toMatch(/gengibre|canela|Chá/)
  })

  it("o span toque marca falha quando o retorno não existe", async () => {
    const { telemetry, deps } = montar()
    await erroDe(tocarRetorno(deps, "c1", "nao-existe", "ajudou"))
    const span = telemetry.spans.find((s) => s.nome === "toque")
    expect(span?.falha).toBeDefined()
  })
})
