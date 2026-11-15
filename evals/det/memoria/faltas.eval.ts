import { describe, expect, it } from "vitest"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"

const CONTA = "conta-1"
const HOJE = "2026-01-15"
const ONTEM = "2026-01-14"
const DESDE = "2000-01-01"

function ambiente() {
  const clock = createFixedClock("2026-01-15T12:00:00-03:00")
  return { stores: createMemoryStores(clock) }
}

describe("faltas por dia", () => {
  it("no máximo uma falta por alimento por dia", async () => {
    const { stores } = ambiente()

    await stores.shortages.registrar(
      CONTA,
      [
        { alimento_id: "banana", origem: "nao_tenho" },
        { alimento_id: "banana", origem: "teria_entrado" },
      ],
      HOJE,
    )
    await stores.shortages.registrar(CONTA, [{ alimento_id: "banana", origem: "nao_tenho" }], HOJE)

    expect(await stores.shortages.diasComFalta(CONTA, DESDE)).toEqual([
      { alimento_id: "banana", dias: 1, ultimo_dia: HOJE },
    ])
  })

  it("dias diferentes contam como faltas diferentes", async () => {
    const { stores } = ambiente()

    await stores.shortages.registrar(CONTA, [{ alimento_id: "banana", origem: "nao_tenho" }], ONTEM)
    await stores.shortages.registrar(CONTA, [{ alimento_id: "banana", origem: "nao_tenho" }], HOJE)

    expect(await stores.shortages.diasComFalta(CONTA, DESDE)).toEqual([
      { alimento_id: "banana", dias: 2, ultimo_dia: HOJE },
    ])
  })
})

describe("registrar em casa", () => {
  it("apaga as faltas do alimento e tira da lista, sem mexer nos outros", async () => {
    const { stores } = ambiente()
    await stores.shortages.registrar(
      CONTA,
      [
        { alimento_id: "banana", origem: "nao_tenho" },
        { alimento_id: "canela", origem: "nao_tenho" },
      ],
      HOJE,
    )
    for (const alimento_id of ["banana", "canela"]) {
      await stores.shortages.porNaLista(CONTA, {
        alimento_id,
        motivo: "faltou_hoje",
        detalhe: "faltou hoje",
      })
    }

    await stores.pantry.registrar(CONTA, [{ alimento_id: "banana" }], "conversa")

    const faltas = await stores.shortages.diasComFalta(CONTA, DESDE)
    expect(faltas.map((f) => f.alimento_id)).toEqual(["canela"])
    const lista = await stores.shortages.lista(CONTA)
    expect(lista.map((l) => l.alimento_id)).toEqual(["canela"])
  })
})
