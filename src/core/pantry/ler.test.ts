import { describe, expect, it } from "vitest"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { lerCasa } from "./ler"
import { visaoDaCasa } from "./visao"

const FUSO = "America/Sao_Paulo"
const CONTA = "conta-1"

async function ambiente() {
  const clock = createFixedClock("2026-11-15T15:00:00Z")
  const stores = createMemoryStores(clock)
  const kb = createMiniKnowledge()
  return { clock, stores, kb, deps: { stores, kb, clock } }
}

describe("lerCasa", () => {
  it("devolve o mesmo que visaoDaCasa com os dados dos stores", async () => {
    const { clock, stores, kb, deps } = await ambiente()
    await stores.pantry.semear(CONTA, [
      { alimento_id: "leite", confirmado_em: new Date("2026-10-01T12:00:00Z") },
      { alimento_id: "banana", confirmado_em: new Date("2026-11-15T12:00:00Z") },
      {
        alimento_id: "canela",
        confirmado_em: new Date("2026-11-15T12:00:00Z"),
        sempre_tenho: true,
      },
    ])
    await stores.shortages.porNaLista(CONTA, {
      alimento_id: "banana",
      motivo: "faltou_hoje",
      detalhe: "almoço",
    })
    await stores.preferences.definirGosto(CONTA, { tipo: "alimento", id: "leite" }, "gosta")

    const itens = await stores.pantry.listar(CONTA)
    const lista = await stores.shortages.lista(CONTA)
    const preferencias = await stores.preferences.ler(CONTA, [
      { tipo: "alimento", id: "leite" },
      { tipo: "alimento", id: "banana" },
      { tipo: "alimento", id: "canela" },
    ])

    const visto = await lerCasa(deps, CONTA, FUSO)
    const esperado = visaoDaCasa({
      itens,
      lista,
      preferencias,
      kb,
      agora: clock.now(),
      fuso: FUSO,
    })
    expect(visto).toEqual(esperado)
    expect(visto.ainda_tem.map((i) => i.alimento_id)).toEqual(["leite"])
    expect(visto.lista).toEqual([
      { alimento_id: "banana", nome: "Banana", motivo: "faltou_hoje", texto: "Faltou para almoço" },
    ])
    expect(visto.vazia).toBe(false)
  })

  it("conta sem itens devolve vazia true", async () => {
    const { deps } = await ambiente()
    const visto = await lerCasa(deps, CONTA, FUSO)
    expect(visto.vazia).toBe(true)
    expect(visto.prateleiras).toEqual([])
    expect(visto.ainda_tem).toEqual([])
  })

  it("não vê os itens de outra conta", async () => {
    const { stores, deps } = await ambiente()
    await stores.pantry.semear("outra", [
      { alimento_id: "banana", confirmado_em: new Date("2026-11-15T12:00:00Z") },
    ])
    const visto = await lerCasa(deps, CONTA, FUSO)
    expect(visto.vazia).toBe(true)
  })
})
