import { afterEach, describe, expect, it, vi } from "vitest"

async function carregar(siteUrl: string | null) {
  vi.resetModules()
  vi.doMock("@config/publico", () => ({ publico: { siteUrl } }))
  return (await import("./sitemap")).default
}

afterEach(() => {
  vi.doUnmock("@config/publico")
})

describe("sitemap", () => {
  it("sem siteUrl: lista vazia", async () => {
    const sitemap = await carregar(null)
    expect(sitemap()).toEqual([])
  })

  it("com siteUrl: lista as três páginas públicas", async () => {
    const sitemap = await carregar("https://ritu.test")
    expect(sitemap().map((item) => item.url)).toEqual([
      "https://ritu.test",
      "https://ritu.test/sobre",
      "https://ritu.test/bastidores",
    ])
  })
})
