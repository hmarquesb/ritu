import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/app/_lib/conta", () => ({
  exigirPasso: async () => ({ conta: { tipo: "google" } }),
}))
vi.mock("@/app/_acoes/sessao", () => ({ sair: async () => {} }))
vi.mock("./aceitar", () => ({ AceitarAviso: () => null }))

describe("AvisoPage", () => {
  it("liga a política de privacidade depois das três frases", async () => {
    const { default: AvisoPage } = await import("./page")
    const html = renderToStaticMarkup(await AvisoPage())
    expect(html).toMatch(
      /<a[^>]*href="\/sobre#privacidade"[^>]*>Leia a política de privacidade<\/a>/,
    )
  })
})
