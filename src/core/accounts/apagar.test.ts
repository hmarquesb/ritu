import { describe, expect, it } from "vitest"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { apagarConta } from "./apagar"
import type { Conta } from "./types"

const DIA = "2026-01-15"
const T = "2026-01-15T12:00:00Z"

function montar() {
  const clock = createFixedClock(T)
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  return { clock, stores, telemetry }
}

async function criarContaComDados(
  stores: ReturnType<typeof montar>["stores"],
  nome: string,
): Promise<Conta> {
  const conta = await stores.accounts.criar({
    tipo: "google",
    google_sub: `sub-${nome}`,
    email: `${nome}@exemplo.com`,
  })
  await stores.pantry.registrar(conta.id, [{ alimento_id: "gengibre" }], "conversa")
  await stores.routine.anotar(conta.id, "acordo cedo")
  await stores.messages.gravar(conta.id, {
    autor: "pessoa",
    texto: "oi",
    com_incomodo: false,
    dia: DIA,
  })
  return conta
}

describe("apagarConta", () => {
  it("apaga a conta e os dados dela", async () => {
    const { stores, telemetry } = montar()
    const conta = await criarContaComDados(stores, "a")

    await apagarConta({ stores, telemetry }, conta)

    expect(await stores.accounts.buscar(conta.id)).toBeUndefined()
    expect(await stores.pantry.listar(conta.id)).toEqual([])
    expect(await stores.routine.notasAtivas(conta.id)).toEqual([])
    expect(await stores.messages.doDia(conta.id, DIA)).toEqual([])
  })

  it("não toca na outra conta", async () => {
    const { stores, telemetry } = montar()
    const conta = await criarContaComDados(stores, "a")
    const outra = await criarContaComDados(stores, "b")

    await apagarConta({ stores, telemetry }, conta)

    expect(await stores.accounts.buscar(outra.id)).toMatchObject({ id: outra.id })
    expect(await stores.pantry.listar(outra.id)).toHaveLength(1)
    expect(await stores.messages.doDia(outra.id, DIA)).toHaveLength(1)
  })

  it("soma a métrica ritu_conta_apagada_total com o tipo da conta", async () => {
    const { stores, telemetry } = montar()
    const conta = await criarContaComDados(stores, "c")

    await apagarConta({ stores, telemetry }, conta)

    expect(telemetry.metricas).toContainEqual({
      tipo: "contador",
      nome: "ritu_conta_apagada_total",
      valor: 1,
      rotulos: { tipo: "google" },
    })
  })

  it("a métrica de uma conta demo sai com tipo demo", async () => {
    const { stores, telemetry } = montar()
    const demo = await stores.accounts.criar({ tipo: "demo", expira_em: new Date(T) })

    await apagarConta({ stores, telemetry }, demo)

    expect(telemetry.metricas).toContainEqual({
      tipo: "contador",
      nome: "ritu_conta_apagada_total",
      valor: 1,
      rotulos: { tipo: "demo" },
    })
  })
})
