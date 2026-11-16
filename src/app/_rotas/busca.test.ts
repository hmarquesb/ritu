import { afterEach, describe, expect, it, vi } from "vitest"
import { createContainer } from "@/infra/container"
import { rotasDeBusca } from "./busca"

async function montar(comSessao = true) {
  vi.stubEnv("RITU_MODO", "e2e")
  const base = createContainer()
  const cities = base.cities as typeof base.cities & { foraDoAr(sim: boolean): void }
  const conta = await base.stores.accounts.criar({
    tipo: "google",
    google_sub: "s",
    email: "a@b.c",
  })
  const container = { ...base, cities }
  const rotas = rotasDeBusca({
    contaDaSessao: async () => (comSessao ? conta.id : undefined),
    container,
  })
  return { rotas, cities, container }
}

const pedido = (caminho: string, q?: string) =>
  new Request(`http://x/api/${caminho}${q === undefined ? "" : `?q=${encodeURIComponent(q)}`}`)

describe("rotasDeBusca", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("cidades: acha pela busca", async () => {
    const { rotas } = await montar()
    const r = await rotas.cidades(pedido("cidades", "lisboa"))
    expect(r.status).toBe(200)
    const { cidades } = await r.json()
    expect(cidades[0].nome).toBe("Lisboa")
  })

  it("cidades: q curto, longo ou ausente é 400", async () => {
    const { rotas } = await montar()
    for (const q of ["a", "x".repeat(61), undefined]) {
      const r = await rotas.cidades(pedido("cidades", q))
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "corpo_invalido" })
    }
  })

  it("cidades: fora do ar é 503", async () => {
    const { rotas, cities } = await montar()
    cities.foraDoAr(true)
    const r = await rotas.cidades(pedido("cidades", "lisboa"))
    expect(r.status).toBe(503)
    expect(await r.json()).toEqual({ erro: "cidades_indisponivel" })
  })

  it("sem sessão é 401", async () => {
    const { rotas } = await montar(false)
    expect((await rotas.cidades(pedido("cidades", "lisboa"))).status).toBe(401)
    expect((await rotas.alimentos(pedido("alimentos", "ab"))).status).toBe(401)
  })

  it("alimentos: ignora acento, ordena e limita", async () => {
    const { rotas, container } = await montar()
    const r = await rotas.alimentos(pedido("alimentos", "abóbora"))
    const { alimentos } = await r.json()
    expect(alimentos.map((a: { id: string }) => a.id)).toContain("abobora")
    const amplo = await (await rotas.alimentos(pedido("alimentos", "ar"))).json()
    const nomes: string[] = amplo.alimentos.map((a: { nome: string }) => a.nome)
    expect(nomes.length).toBeLessThanOrEqual(
      container.config.limites.buscaDeAlimento.maximoResultados,
    )
    expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, "pt")))
  })

  it("alimentos: q curto ou longo é 400", async () => {
    const { rotas } = await montar()
    for (const q of ["a", "x".repeat(41)]) {
      expect((await rotas.alimentos(pedido("alimentos", q))).status).toBe(400)
    }
  })
})
