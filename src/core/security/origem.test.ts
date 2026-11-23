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

  describe("caminho do MCP", () => {
    it("POST /api/mcp sem Origin vale", () => {
      expect(origemValida({ metodo: "POST", origin: null, host, caminho: "/api/mcp" })).toBe(true)
    })

    it("POST /api/mcp com o Origin do site vale", () => {
      expect(
        origemValida({
          metodo: "POST",
          origin: "http://localhost:3000",
          host,
          caminho: "/api/mcp",
        }),
      ).toBe(true)
    })

    it("POST /api/mcp com outro Origin não vale", () => {
      expect(
        origemValida({ metodo: "POST", origin: "https://evil.example", host, caminho: "/api/mcp" }),
      ).toBe(false)
    })

    it("POST /api/runs sem Origin continua não valendo", () => {
      expect(origemValida({ metodo: "POST", origin: null, host, caminho: "/api/runs" })).toBe(false)
    })

    it("GET no MCP vale como antes", () => {
      expect(origemValida({ metodo: "GET", origin: null, host, caminho: "/api/mcp" })).toBe(true)
    })
  })
})
