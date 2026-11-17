import { describe, expect, it } from "vitest"
import { origemValida } from "./origem"

describe("origemValida", () => {
  const host = "localhost:3000"

  it("mesmo host, com porta, vale", () => {
    expect(origemValida({ metodo: "POST", origin: "http://localhost:3000", host })).toBe(true)
  })

  it("outro site não vale", () => {
    expect(origemValida({ metodo: "POST", origin: "https://evil.example", host })).toBe(false)
  })

  it("POST sem Origin não vale", () => {
    expect(origemValida({ metodo: "POST", origin: null, host })).toBe(false)
  })

  it("Origin inválido não vale", () => {
    expect(origemValida({ metodo: "DELETE", origin: "não é url", host })).toBe(false)
  })

  it("GET, HEAD e OPTIONS sempre valem", () => {
    for (const metodo of ["GET", "HEAD", "OPTIONS"]) {
      expect(origemValida({ metodo, origin: null, host })).toBe(true)
    }
  })
})
