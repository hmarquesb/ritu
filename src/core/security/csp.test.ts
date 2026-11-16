import { describe, expect, it } from "vitest"
import { headersDeSeguranca, montarCsp } from "./csp"

const diretiva = (csp: string, nome: string): string =>
  csp.split(";").find((parte) => parte.trim().startsWith(`${nome} `)) ?? ""

describe("montarCsp", () => {
  const csp = montarCsp({ nonce: "abc", dev: false })

  it("põe o nonce em script-src e style-src", () => {
    expect(diretiva(csp, "script-src")).toContain("'nonce-abc'")
    expect(diretiva(csp, "style-src")).toContain("'nonce-abc'")
  })

  it("não libera script inline", () => {
    expect(diretiva(csp, "script-src")).not.toContain("unsafe-inline")
    expect(diretiva(csp, "script-src")).toContain("'strict-dynamic'")
  })

  it("nega moldura, objeto e restringe formulário", () => {
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("form-action 'self' https://accounts.google.com")
    expect(csp).toContain("style-src-attr 'unsafe-inline'")
  })

  it("só libera unsafe-eval em dev", () => {
    expect(csp).not.toContain("unsafe-eval")
    expect(montarCsp({ nonce: "abc", dev: true })).toContain("'unsafe-eval'")
  })
})

describe("headersDeSeguranca", () => {
  it("sem https não tem HSTS", () => {
    const h = headersDeSeguranca({ nonce: "abc", dev: false, https: false })
    expect(h["Content-Security-Policy"]).toContain("'nonce-abc'")
    expect(h["X-Content-Type-Options"]).toBe("nosniff")
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin")
    expect(h["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=()")
    expect(h["Strict-Transport-Security"]).toBeUndefined()
  })

  it("com https tem HSTS", () => {
    const h = headersDeSeguranca({ nonce: "abc", dev: false, https: true })
    expect(h["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains")
  })
})
