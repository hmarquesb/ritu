import { describe, expect, it } from "vitest"
import { dataCurta } from "./datas"

describe("dataCurta", () => {
  it("abrevia o mês e tira o zero do dia", () => {
    expect(dataCurta("2026-12-03")).toBe("3 de dez.")
    expect(dataCurta("2026-01-10")).toBe("10 de jan.")
  })
  it("aceita data com hora", () => {
    expect(dataCurta("2026-11-02T10:00:00Z")).toBe("2 de nov.")
  })
  it("devolve o que não reconhece", () => {
    expect(dataCurta("ontem")).toBe("ontem")
  })
})
