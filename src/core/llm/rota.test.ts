import { describe, expect, it } from "vitest"
import { rotaDe, separarRota } from "./rota"

describe("rota", () => {
  it("rotaDe não põe sufixo com uma só chave", () => {
    expect(rotaDe("m", 1, 1)).toBe("m")
    expect(rotaDe("m", 1, 3)).toBe("m@1")
    expect(rotaDe("m", 3, 3)).toBe("m@3")
  })

  it("separarRota sem sufixo é a chave 1", () => {
    expect(separarRota("gemini-x")).toEqual({ modelo: "gemini-x", chave: 1 })
    expect(separarRota("gemini-x@2")).toEqual({ modelo: "gemini-x", chave: 2 })
  })
})
