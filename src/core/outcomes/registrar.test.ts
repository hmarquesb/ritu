import { describe, expect, it } from "vitest"
import type { SugestaoRegistrada } from "@/core/memory-schemas"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { registrarResultado } from "./registrar"

function montar() {
  const stores = createMemoryStores(createFixedClock("2026-05-10T12:00:00Z"))
  const telemetry = createMemoryTelemetry()
  return { stores, telemetry, deps: { tx: stores, telemetry } }
}

const pratica: SugestaoRegistrada = {
  tipo: "pratica",
  pratica_id: "abhyanga",
  alimentos: ["gengibre", "cominho"],
  titulo: "Óleo",
}
const preparo: SugestaoRegistrada = {
  tipo: "cha",
  preparo_id: "cha-gengibre",
  alimentos: [],
  titulo: "Chá",
}

async function criar(
  stores: ReturnType<typeof montar>["stores"],
  conta: string,
  s: SugestaoRegistrada,
) {
  const [r] = await stores.outcomes.criar(conta, "run1", [s])
  if (!r) throw new Error("retorno não criado")
  return r
}

async function pref(
  stores: ReturnType<typeof montar>["stores"],
  tipo: "pratica" | "preparo" | "alimento",
  id: string,
) {
  return (await stores.preferences.ler("c1", [{ tipo, id }]))[0]
}

describe("registrarResultado", () => {
  it("fecha o retorno de prática e soma prática e alimentos", async () => {
    const { stores, telemetry, deps } = montar()
    const r = await criar(stores, "c1", pratica)
    const res = await registrarResultado(deps, "c1", r.id, "ajudou", "conversa")
    expect(res?.status).toBe("respondido")
    expect(res?.origem).toBe("conversa")
    expect((await pref(stores, "pratica", "abhyanga"))?.ajudou).toBe(1)
    expect((await pref(stores, "alimento", "gengibre"))?.ajudou).toBe(1)
    expect((await pref(stores, "alimento", "cominho"))?.ajudou).toBe(1)
    expect(telemetry.metricas).toHaveLength(1)
    expect(telemetry.metricas[0]).toMatchObject({
      nome: "ritu_retorno_total",
      valor: 1,
      rotulos: { resultado: "ajudou", origem: "conversa" },
    })
  })

  it("soma no preparo", async () => {
    const { stores, deps } = montar()
    const r = await criar(stores, "c1", preparo)
    await registrarResultado(deps, "c1", r.id, "nao_ajudou", "toque")
    expect((await pref(stores, "preparo", "cha-gengibre"))?.nao_ajudou).toBe(1)
  })

  it("conta uma vez só", async () => {
    const { stores, telemetry, deps } = montar()
    const r = await criar(stores, "c1", pratica)
    await registrarResultado(deps, "c1", r.id, "ajudou", "toque")
    const segunda = await registrarResultado(deps, "c1", r.id, "nao_ajudou", "conversa")
    expect(segunda?.status).toBe("respondido")
    expect(segunda?.resultado).toBe("ajudou")
    expect((await pref(stores, "pratica", "abhyanga"))?.ajudou).toBe(1)
    expect((await pref(stores, "pratica", "abhyanga"))?.nao_ajudou).toBe(0)
    expect(telemetry.metricas).toHaveLength(1)
  })

  it("id inexistente ou de outra conta devolve undefined sem contar", async () => {
    const { stores, telemetry, deps } = montar()
    const r = await criar(stores, "c2", pratica)
    expect(await registrarResultado(deps, "c1", "nada", "ajudou", "toque")).toBeUndefined()
    expect(await registrarResultado(deps, "c1", r.id, "ajudou", "toque")).toBeUndefined()
    expect(await stores.preferences.ler("c1")).toEqual([])
    expect(await stores.preferences.ler("c2")).toEqual([])
    expect(telemetry.metricas).toHaveLength(0)
  })

  it("nao_fez não entra em ultimos_resultados", async () => {
    const { stores, deps } = montar()
    const r = await criar(stores, "c1", pratica)
    await registrarResultado(deps, "c1", r.id, "nao_fez", "toque")
    const p = await pref(stores, "pratica", "abhyanga")
    expect(p?.nao_fez).toBe(1)
    expect(p?.ultimos_resultados).toEqual([])
  })
})
