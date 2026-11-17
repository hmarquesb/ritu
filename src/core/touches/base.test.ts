import { describe, expect, it } from "vitest"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { nomeNaBase } from "./base"

describe("nomeNaBase", () => {
  const kb = createMiniKnowledge()

  it("devolve o nome do alimento, do preparo e da prática que estão na base", () => {
    expect(nomeNaBase(kb, { tipo: "alimento", id: "gengibre" })).toBe(kb.alimento("gengibre")?.nome)
    expect(nomeNaBase(kb, { tipo: "preparo", id: "cha-gengibre" })).toBe(
      kb.preparo("cha-gengibre")?.nome,
    )
    expect(nomeNaBase(kb, { tipo: "pratica", id: "oleo-pes-gergelim" })).toBe(
      kb.pratica("oleo-pes-gergelim")?.nome,
    )
  })

  it("devolve undefined para um id fora da base, em cada tipo", () => {
    expect(nomeNaBase(kb, { tipo: "alimento", id: "nao-existe" })).toBeUndefined()
    expect(nomeNaBase(kb, { tipo: "preparo", id: "nao-existe" })).toBeUndefined()
    expect(nomeNaBase(kb, { tipo: "pratica", id: "nao-existe" })).toBeUndefined()
  })

  it("olha só o tipo pedido: um id de alimento não é preparo nem prática", () => {
    expect(nomeNaBase(kb, { tipo: "preparo", id: "gengibre" })).toBeUndefined()
    expect(nomeNaBase(kb, { tipo: "pratica", id: "gengibre" })).toBeUndefined()
  })
})
