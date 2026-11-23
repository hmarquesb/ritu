import { afterEach, describe, expect, it, vi } from "vitest"

type Regra = { allow?: string | string[]; disallow?: string | string[] }

async function carregar(siteUrl: string | null) {
  vi.resetModules()
  vi.doMock("@config/publico", () => ({ publico: { siteUrl } }))
  return (await import("./robots")).default
}

afterEach(() => {
  vi.doUnmock("@config/publico")
})

describe("robots", () => {
  it("sem siteUrl: permite as públicas, bloqueia as de quem entrou e não aponta sitemap", async () => {
    const robots = await carregar(null)
    const r = robots()
    const regra = r.rules as Regra
    expect(regra.allow).toEqual(["/", "/sobre", "/bastidores", "/marca/og.jpg"])
    expect(regra.disallow).toEqual([
      "/api/",
      "/comecar/",
      "/conversa",
      "/casa",
      "/como-ficou",
      "/voce",
      "/marca",
    ])
    expect(r.sitemap).toBeUndefined()
  })

  it("libera a imagem de compartilhamento mesmo com /marca bloqueado", async () => {
    const robots = await carregar(null)
    const regra = robots().rules as Regra
    expect(regra.allow).toContain("/marca/og.jpg")
    expect(regra.disallow).toContain("/marca")
  })

  it("com siteUrl: aponta o sitemap na URL do site", async () => {
    const robots = await carregar("https://ritu.test")
    expect(robots().sitemap).toBe("https://ritu.test/sitemap.xml")
  })
})
