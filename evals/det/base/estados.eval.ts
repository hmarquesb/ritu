import { describe, expect, it } from "vitest"
import { qualidadesDoMomento } from "@/core/knowledge/momento"
import { getContainer } from "@/infra/container"

const kb = getContainer().knowledge
const ordenado = (xs: readonly string[]) => [...xs].sort()

const estados = kb.estados.map((e) => ({ nome: e.id, linha: e }))

const variantes = kb.incomodos.flatMap((i) =>
  i.variantes.map((v) => ({
    nome: `${i.id}/${v.id}`,
    incomodo: i.id,
    variante: v.id,
    presentes: v.presentes,
    favorecer: v.favorecer,
  })),
)

describe("estados da base real", () => {
  it.each(estados)("$nome devolve presentes e buscadas iguais à linha", ({ nome, linha }) => {
    const q = qualidadesDoMomento({ estados: [nome] }, kb)

    expect(ordenado(q.presentes)).toEqual(ordenado(linha.presentes))
    expect(ordenado(q.buscadas)).toEqual(ordenado(linha.favorecer))
    expect(q.linhas_base).toEqual([`estados:${nome}`])
  })
})

describe("variantes de incômodo da base real", () => {
  it.each(variantes)(
    "$nome devolve presentes e buscadas iguais à variante",
    ({ incomodo, variante, presentes, favorecer }) => {
      const q = qualidadesDoMomento({ estados: [], incomodo: { id: incomodo, variante } }, kb)

      expect(ordenado(q.presentes)).toEqual(ordenado(presentes))
      expect(ordenado(q.buscadas)).toEqual(ordenado(favorecer))
      expect(q.precisa_variante).toBeUndefined()
    },
  )
})

describe("conflitos e perguntas", () => {
  it("com_calor + pesada devolve conflito quente/frio", () => {
    const q = qualidadesDoMomento({ estados: ["com_calor", "pesada"] }, kb)

    expect(q.conflitos.map((par) => ordenado(par))).toEqual([["frio", "quente"]])
  })

  it("dor-de-cabeca sem variante pede a variante com 3 opções", () => {
    const q = qualidadesDoMomento({ estados: [], incomodo: { id: "dor-de-cabeca" } }, kb)

    expect(q.precisa_variante?.incomodo).toBe("dor-de-cabeca")
    expect(q.precisa_variante?.opcoes).toHaveLength(3)
    expect(q.presentes).toEqual([])
    expect(q.linhas_base).toEqual([])
  })
})
