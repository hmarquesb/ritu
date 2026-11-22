import { afterEach, describe, expect, it, vi } from "vitest"
import { quemPedeDosHeaders, quemPedeNext } from "./next"

vi.mock("next-auth", () => ({
  default: () => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }),
  AuthError: class extends Error {},
  CredentialsSignin: class extends Error {},
}))
vi.mock("next-auth/providers/credentials", () => ({ default: () => ({}) }))
vi.mock("next-auth/providers/google", () => ({ default: () => ({}) }))

const pedido = (h: Record<string, string>) =>
  new Request("http://x/api", { method: "POST", headers: h })

describe("quemPedeNext", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("fora do modo e2e ignora os headers de escopo e teto", () => {
    vi.stubEnv("RITU_MODO", "")
    vi.stubEnv("IP_HMAC_SECRET", "segredo")
    const q = quemPedeNext(pedido({ "x-ritu-e2e": "a", "x-ritu-e2e-teto": "5" }))
    expect(q.escopo).toBeUndefined()
    expect(q.teto).toBeUndefined()
    expect(q.ipHash).toHaveLength(32)
  })

  it("no modo e2e lê escopo e teto de 1 a 100", () => {
    vi.stubEnv("RITU_MODO", "e2e")
    vi.stubEnv("IP_HMAC_SECRET", "segredo")
    expect(quemPedeNext(pedido({ "x-ritu-e2e": "a", "x-ritu-e2e-teto": "5" }))).toMatchObject({
      escopo: "a",
      teto: 5,
    })
    expect(quemPedeNext(pedido({ "x-ritu-e2e-teto": "0" })).teto).toBeUndefined()
    expect(quemPedeNext(pedido({ "x-ritu-e2e-teto": "101" })).teto).toBeUndefined()
  })
})

describe("quemPedeDosHeaders", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("dá o mesmo resultado que quemPedeNext", () => {
    vi.stubEnv("RITU_MODO", "e2e")
    vi.stubEnv("IP_HMAC_SECRET", "segredo")
    const h = { "x-ritu-e2e": "a", "x-ritu-e2e-teto": "7" }
    expect(quemPedeDosHeaders(new Headers(h))).toEqual(quemPedeNext(pedido(h)))
  })
})
