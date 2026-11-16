import { describe, expect, it } from "vitest"
import { headersDeSeguranca, montarCsp } from "@/core/security/csp"
import { origemValida } from "@/core/security/origem"

const HOST = "ritu.exemplo"

describe("origemValida", () => {
  it("recusa um POST vindo de outro site", () => {
    expect(origemValida({ metodo: "POST", origin: "https://outro.exemplo", host: HOST })).toBe(
      false,
    )
  })

  it("recusa um POST sem Origin", () => {
    expect(origemValida({ metodo: "POST", origin: null, host: HOST })).toBe(false)
  })

  it("aceita um POST do mesmo host", () => {
    expect(origemValida({ metodo: "POST", origin: `https://${HOST}`, host: HOST })).toBe(true)
  })

  it("aceita um GET sem Origin, porque método seguro não muda estado", () => {
    expect(origemValida({ metodo: "GET", origin: null, host: HOST })).toBe(true)
  })
})

describe("CSP", () => {
  const csp = montarCsp({ nonce: "n0nce", dev: false })
  const diretiva = (nome: string): string =>
    csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith(`${nome} `)) ?? ""

  it("usa nonce em script-src", () => {
    expect(diretiva("script-src")).toContain("'nonce-n0nce'")
  })

  it("não tem unsafe-inline em script-src", () => {
    expect(diretiva("script-src")).not.toContain("'unsafe-inline'")
  })

  it("tem frame-ancestors 'none'", () => {
    expect(diretiva("frame-ancestors")).toBe("frame-ancestors 'none'")
  })
})

describe("headersDeSeguranca", () => {
  const headers = headersDeSeguranca({ nonce: "n0nce", dev: false, https: false })

  it("traz os quatro headers da spec", () => {
    expect(headers["Content-Security-Policy"]).toBeDefined()
    expect(headers["X-Content-Type-Options"]).toBe("nosniff")
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin")
    expect(headers["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=()")
  })

  it("a CSP dos headers é a mesma de montarCsp", () => {
    expect(headers["Content-Security-Policy"]).toBe(montarCsp({ nonce: "n0nce", dev: false }))
  })
})
