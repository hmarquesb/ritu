import { describe, expect, it } from "vitest"
import { escolherCaminho } from "./caminhos"

describe("escolherCaminho", () => {
  it("alerta vence as outras intenções", () => {
    expect(
      escolherCaminho({ intencoes: ["casa", "momento"], alerta: "x", suspeito: false }),
    ).toEqual({ caminho: "alerta", intencoes: ["alerta"] })
  })

  it("alerta vence suspeito", () => {
    expect(escolherCaminho({ intencoes: ["momento"], alerta: "x", suspeito: true })).toEqual({
      caminho: "alerta",
      intencoes: ["alerta"],
    })
  })

  it("suspeito vai para fora mesmo com momento", () => {
    expect(escolherCaminho({ intencoes: ["momento"], suspeito: true })).toEqual({
      caminho: "fora",
      intencoes: ["fora"],
    })
  })

  it("ofensa e ajuda juntas vão para ajuda", () => {
    expect(escolherCaminho({ intencoes: ["ofensa", "ajuda"], suspeito: false })).toEqual({
      caminho: "ajuda",
      intencoes: ["ajuda"],
    })
  })

  it("fora entre ofensa e ajuda vence na ordem fora, ajuda, ofensa", () => {
    expect(escolherCaminho({ intencoes: ["ofensa", "fora", "ajuda"], suspeito: false })).toEqual({
      caminho: "fora",
      intencoes: ["fora"],
    })
  })

  it("só ofensa vai para ofensa", () => {
    expect(escolherCaminho({ intencoes: ["ofensa"], suspeito: false })).toEqual({
      caminho: "ofensa",
      intencoes: ["ofensa"],
    })
  })

  it.each(["casa", "retorno", "evitar"])("só %s vai para %s", (intencao) => {
    expect(escolherCaminho({ intencoes: [intencao], suspeito: false })).toEqual({
      caminho: intencao,
      intencoes: [intencao],
    })
  })

  it("casa com ofensa vai para casa, sem ofensa", () => {
    expect(escolherCaminho({ intencoes: ["casa", "ofensa"], suspeito: false })).toEqual({
      caminho: "casa",
      intencoes: ["casa"],
    })
  })

  it("casa com momento vai para acompanhante com as duas", () => {
    expect(escolherCaminho({ intencoes: ["casa", "momento"], suspeito: false })).toEqual({
      caminho: "acompanhante",
      intencoes: ["casa", "momento"],
    })
  })

  it("momento com ofensa vai para acompanhante só com momento", () => {
    expect(escolherCaminho({ intencoes: ["momento", "ofensa"], suspeito: false })).toEqual({
      caminho: "acompanhante",
      intencoes: ["momento"],
    })
  })

  it.each(["pergunta", "vida"])("só %s vai para acompanhante", (intencao) => {
    expect(escolherCaminho({ intencoes: [intencao], suspeito: false })).toEqual({
      caminho: "acompanhante",
      intencoes: [intencao],
    })
  })

  it("evitar com momento vai para acompanhante com as duas", () => {
    expect(escolherCaminho({ intencoes: ["evitar", "momento"], suspeito: false })).toEqual({
      caminho: "acompanhante",
      intencoes: ["evitar", "momento"],
    })
  })
})
