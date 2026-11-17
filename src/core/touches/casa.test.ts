import { describe, expect, it } from "vitest"
import { RituError } from "@/core/errors"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { acaoDaCasaSchema, tocarCasa } from "./casa"
import type { Deps } from "./deps"

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

async function idDoItem(
  stores: ReturnType<typeof montar>["stores"],
  contaId: string,
  alimentoId: string,
): Promise<string> {
  const item = (await stores.pantry.listar(contaId)).find((i) => i.alimento_id === alimentoId)
  if (!item) throw new Error("item de teste ausente")
  return item.id
}

describe("acaoDaCasaSchema", () => {
  it("aceita as seis ações com o formato do contrato", () => {
    const id = "11111111-1111-4111-8111-111111111111"
    expect(acaoDaCasaSchema.safeParse({ acao: "adicionar", alimento_id: "leite" }).success).toBe(
      true,
    )
    expect(acaoDaCasaSchema.safeParse({ acao: "adicionar_texto", texto: "abóbora" }).success).toBe(
      true,
    )
    expect(acaoDaCasaSchema.safeParse({ acao: "tenho", item_id: id }).success).toBe(true)
    expect(acaoDaCasaSchema.safeParse({ acao: "acabou", item_id: id }).success).toBe(true)
    expect(
      acaoDaCasaSchema.safeParse({ acao: "sempre_tenho", item_id: id, valor: true }).success,
    ).toBe(true)
    expect(acaoDaCasaSchema.safeParse({ acao: "tirar", item_id: id }).success).toBe(true)
  })

  it("recusa campo extra e texto curto demais", () => {
    expect(
      acaoDaCasaSchema.safeParse({ acao: "adicionar", alimento_id: "leite", extra: 1 }).success,
    ).toBe(false)
    expect(acaoDaCasaSchema.safeParse({ acao: "adicionar_texto", texto: "a" }).success).toBe(false)
  })
})

describe("tocarCasa", () => {
  it("adicionar põe o alimento da base na casa como tela e devolve o nome da base", async () => {
    const { stores, telemetry, deps } = montar()
    const r = await tocarCasa(deps, "c1", { acao: "adicionar", alimento_id: "leite" })
    expect(r).toEqual({ nome: "Leite" })
    const item = (await stores.pantry.listar("c1"))[0]
    expect(item).toMatchObject({ alimento_id: "leite", estado: "tem", origem: "tela" })
    expect(telemetry.spans.find((s) => s.nome === "toque")?.atributos).toEqual({ tipo: "casa" })
  })

  it("adicionar com alimento fora da base recusa com toque_invalido e não grava", async () => {
    const { stores, deps } = montar()
    const erro = await erroDe(
      tocarCasa(deps, "c1", { acao: "adicionar", alimento_id: "nao-existe" }),
    )
    expect(erro).toBeInstanceOf(RituError)
    expect(erro).toMatchObject({ code: "toque_invalido", message: "Toque inválido" })
    expect(await stores.pantry.listar("c1")).toHaveLength(0)
  })

  it("adicionar_texto com 'abóbora' cai no alimento da base", async () => {
    const { stores, deps } = montar()
    const r = await tocarCasa(deps, "c1", { acao: "adicionar_texto", texto: "abóbora" })
    expect(r.nome).toBe("Abóbora")
    expect((await stores.pantry.listar("c1"))[0]).toMatchObject({ alimento_id: "abobora" })
  })

  it("adicionar_texto com texto desconhecido vira nome_livre", async () => {
    const { stores, deps } = montar()
    const r = await tocarCasa(deps, "c1", { acao: "adicionar_texto", texto: "jaca verde" })
    expect(r.nome).toBe("jaca verde")
    expect((await stores.pantry.listar("c1"))[0]).toMatchObject({
      alimento_id: null,
      nome_livre: "jaca verde",
      estado: "tem",
    })
  })

  it("tenho confirma o item da conta e apaga a falta dele", async () => {
    const { stores, deps } = montar()
    await stores.pantry.registrar("c1", [{ alimento_id: "leite" }], "conversa")
    await stores.pantry.marcarAcabou("c1", [{ alimento_id: "leite" }])
    const id = await idDoItem(stores, "c1", "leite")
    await tocarCasa(deps, "c1", { acao: "tenho", item_id: id })
    expect((await stores.pantry.listar("c1"))[0]).toMatchObject({ estado: "tem", origem: "tela" })
  })

  it("tenho recusa item de outra conta e não muda nada", async () => {
    const { stores, deps } = montar()
    await stores.pantry.registrar("c2", [{ alimento_id: "leite" }], "conversa")
    await stores.pantry.marcarAcabou("c2", [{ alimento_id: "leite" }])
    const id = await idDoItem(stores, "c2", "leite")
    const erro = await erroDe(tocarCasa(deps, "c1", { acao: "tenho", item_id: id }))
    expect(erro).toMatchObject({ code: "toque_invalido" })
    expect((await stores.pantry.listar("c2"))[0]).toMatchObject({ estado: "acabou" })
  })

  it("acabou marca o item como acabado e não grava falta", async () => {
    const { stores, deps } = montar()
    await stores.pantry.registrar("c1", [{ alimento_id: "leite" }], "conversa")
    const id = await idDoItem(stores, "c1", "leite")
    await tocarCasa(deps, "c1", { acao: "acabou", item_id: id })
    expect((await stores.pantry.listar("c1"))[0]).toMatchObject({ estado: "acabou" })
    expect(await stores.shortages.diasComFalta("c1", "2026-01-01")).toEqual([])
  })

  it("acabou recusa item de outra conta", async () => {
    const { stores, deps } = montar()
    await stores.pantry.registrar("c2", [{ alimento_id: "leite" }], "conversa")
    const id = await idDoItem(stores, "c2", "leite")
    const erro = await erroDe(tocarCasa(deps, "c1", { acao: "acabou", item_id: id }))
    expect(erro).toMatchObject({ code: "toque_invalido" })
    expect((await stores.pantry.listar("c2"))[0]).toMatchObject({ estado: "tem" })
  })

  it("sempre_tenho liga e desliga em item da conta", async () => {
    const { stores, deps } = montar()
    await stores.pantry.registrar("c1", [{ alimento_id: "leite" }], "conversa")
    const id = await idDoItem(stores, "c1", "leite")
    await tocarCasa(deps, "c1", { acao: "sempre_tenho", item_id: id, valor: true })
    expect((await stores.pantry.listar("c1"))[0]).toMatchObject({ sempre_tenho: true })
    await tocarCasa(deps, "c1", { acao: "sempre_tenho", item_id: id, valor: false })
    expect((await stores.pantry.listar("c1"))[0]).toMatchObject({ sempre_tenho: false })
  })

  it("sempre_tenho true em item acabado recusa", async () => {
    const { stores, deps } = montar()
    await stores.pantry.registrar("c1", [{ alimento_id: "leite" }], "conversa")
    await stores.pantry.marcarAcabou("c1", [{ alimento_id: "leite" }])
    const id = await idDoItem(stores, "c1", "leite")
    const erro = await erroDe(
      tocarCasa(deps, "c1", { acao: "sempre_tenho", item_id: id, valor: true }),
    )
    expect(erro).toMatchObject({ code: "toque_invalido" })
    expect((await stores.pantry.listar("c1"))[0]).toMatchObject({ sempre_tenho: false })
  })

  it("sempre_tenho recusa item de outra conta", async () => {
    const { stores, deps } = montar()
    await stores.pantry.registrar("c2", [{ alimento_id: "leite" }], "conversa")
    const id = await idDoItem(stores, "c2", "leite")
    const erro = await erroDe(
      tocarCasa(deps, "c1", { acao: "sempre_tenho", item_id: id, valor: true }),
    )
    expect(erro).toMatchObject({ code: "toque_invalido" })
  })

  it("tirar remove o item da conta", async () => {
    const { stores, deps } = montar()
    await stores.pantry.registrar("c1", [{ alimento_id: "leite" }], "conversa")
    const id = await idDoItem(stores, "c1", "leite")
    await tocarCasa(deps, "c1", { acao: "tirar", item_id: id })
    expect(await stores.pantry.listar("c1")).toHaveLength(0)
  })

  it("tirar recusa item de outra conta", async () => {
    const { stores, deps } = montar()
    await stores.pantry.registrar("c2", [{ alimento_id: "leite" }], "conversa")
    const id = await idDoItem(stores, "c2", "leite")
    const erro = await erroDe(tocarCasa(deps, "c1", { acao: "tirar", item_id: id }))
    expect(erro).toMatchObject({ code: "toque_invalido" })
    expect(await stores.pantry.listar("c2")).toHaveLength(1)
  })

  it("span toque leva só { tipo: 'casa' }, sem nome de alimento", async () => {
    const { stores, telemetry, deps } = montar()
    await stores.pantry.registrar("c1", [{ alimento_id: "leite" }], "conversa")
    const id = await idDoItem(stores, "c1", "leite")
    await tocarCasa(deps, "c1", { acao: "tirar", item_id: id })
    const span = telemetry.spans.find((s) => s.nome === "toque")
    expect(span?.atributos).toEqual({ tipo: "casa" })
  })
})
