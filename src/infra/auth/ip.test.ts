import { describe, expect, it } from "vitest"
import { hashDoIp, ipDoPedido } from "./ip"

describe("ipDoPedido", () => {
  it("usa o primeiro de x-forwarded-for, sem espaços", () => {
    const h = new Headers({ "x-forwarded-for": "  1.2.3.4 , 5.6.7.8" })
    expect(ipDoPedido(h, false)).toBe("1.2.3.4")
  })
  it("sem header devolve desconhecido", () => {
    expect(ipDoPedido(new Headers(), false)).toBe("desconhecido")
  })
  it("x-ritu-e2e só vale no modo e2e", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4", "x-ritu-e2e": "cenario-a" })
    expect(ipDoPedido(h, true)).toBe("cenario-a")
    expect(ipDoPedido(h, false)).toBe("1.2.3.4")
  })
  it("no modo e2e sem x-ritu-e2e cai no x-forwarded-for", () => {
    expect(ipDoPedido(new Headers({ "x-forwarded-for": "1.2.3.4" }), true)).toBe("1.2.3.4")
  })
})

describe("hashDoIp", () => {
  it("é determinístico, hexadecimal de 32 caracteres e sem o IP", () => {
    const a = hashDoIp("1.2.3.4", "segredo")
    expect(hashDoIp("1.2.3.4", "segredo")).toBe(a)
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(a).not.toContain("1.2.3.4")
  })
  it("muda com o segredo", () => {
    expect(hashDoIp("1.2.3.4", "a")).not.toBe(hashDoIp("1.2.3.4", "b"))
  })
})
