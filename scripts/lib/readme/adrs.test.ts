import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { RituError } from "@/core/errors"
import { lerAdrs } from "./adrs"

const pasta = (nome: string) => fileURLToPath(new URL(`./fixtures/${nome}`, import.meta.url))

describe("lerAdrs", () => {
  it("lê os NNNN-*.md em ordem, sem README nem _template, com o título sem o prefixo", () => {
    expect(lerAdrs(pasta("adrs"))).toEqual([
      { numero: "0001", arquivo: "0001-primeira.md", titulo: "Primeira decisão" },
      { numero: "0002", arquivo: "0002-segunda.md", titulo: "Segunda decisão" },
    ])
  })

  it("ADR sem linha '# ' falha com o nome do arquivo", () => {
    expect(() => lerAdrs(pasta("adrs-sem-titulo"))).toThrowError(RituError)
    expect(() => lerAdrs(pasta("adrs-sem-titulo"))).toThrowError(/0001-sem-titulo\.md/)
  })
})
