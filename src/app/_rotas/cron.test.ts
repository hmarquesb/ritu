import { afterEach, describe, expect, it, vi } from "vitest"
import { createContainer } from "@/infra/container"
import { rotaDaLimpeza } from "./cron"

function montar() {
  vi.stubEnv("RITU_MODO", "e2e")
  return rotaDaLimpeza({ container: createContainer(), segredo: () => "segredo123" })
}

const pedido = (auth?: string) =>
  new Request("http://x/api/cron/limpeza", { headers: auth ? { authorization: auth } : {} })

describe("rotaDaLimpeza", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("401 sem header, com segredo errado ou de outro tamanho", async () => {
    const rota = montar()
    for (const h of [undefined, "Bearer errado0123", "Bearer x", "segredo123"]) {
      const r = await rota(pedido(h))
      expect(r.status).toBe(401)
      expect(await r.json()).toEqual({ erro: "sem_autorizacao" })
    }
  })

  it("com o segredo certo devolve as contagens", async () => {
    const r = await montar()(pedido("Bearer segredo123"))
    expect(r.status).toBe(200)
    const corpo = await r.json()
    expect(corpo.limites).toBe(0)
    expect(corpo.demos).toBe(0)
  })
})
