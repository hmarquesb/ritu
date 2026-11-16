import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { RituError } from "@/core/errors"
import { createContainer } from "@/infra/container"
import { criarRota } from "./rota"

// Modo de E2E: o container usa stores em memória, sem banco.
function montar() {
  vi.stubEnv("RITU_MODO", "e2e")
  const container = createContainer()
  return { stores: container.stores, container }
}

function pedido(corpo?: string, cabecalhos: Record<string, string> = {}) {
  return new Request("http://x/api", {
    method: "POST",
    body: corpo,
    headers: cabecalhos,
  })
}

const schema = z.object({ n: z.number() })

describe("criarRota", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("401 sem sessão", async () => {
    const { container } = montar()
    const rota = criarRota({ contaDaSessao: async () => undefined, container }, {}, async () => 1)
    const r = await rota(pedido())
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ erro: "sem_sessao" })
  })

  it("401 com conta inexistente ou de demonstração vencida", async () => {
    const { container, stores } = montar()
    const conta = await stores.accounts.criar({
      tipo: "demo",
      expira_em: new Date(Date.now() - 1000),
    })
    const rota = criarRota({ contaDaSessao: async () => conta.id, container }, {}, async () => 1)
    const r = await rota(pedido())
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ erro: "sem_sessao" })
  })

  async function comConta() {
    const m = montar()
    const conta = await m.stores.accounts.criar({ tipo: "google", google_sub: "s", email: "a@b.c" })
    const deps = { contaDaSessao: async () => conta.id, container: m.container }
    return { ...m, conta, deps }
  }

  it("413 com corpo acima do limite (content-length e tamanho lido)", async () => {
    const { deps } = await comConta()
    const rota = criarRota(deps, { corpo: schema }, async () => 1)
    const a = await rota(pedido("{}", { "content-length": "999999" }))
    expect(a.status).toBe(413)
    expect(await a.json()).toEqual({ erro: "corpo_grande" })
    const grande = JSON.stringify({ n: 1, x: "a".repeat(20_000) })
    const b = await rota(pedido(grande))
    expect(b.status).toBe(413)
  })

  it("400 com JSON quebrado e com schema inválido", async () => {
    const { deps } = await comConta()
    const rota = criarRota(deps, { corpo: schema }, async () => 1)
    for (const corpo of ["{quebrado", JSON.stringify({ n: "x" })]) {
      const r = await rota(pedido(corpo))
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "corpo_invalido" })
    }
  })

  it("400 com RituError", async () => {
    const { deps } = await comConta()
    const rota = criarRota(deps, {}, async () => {
      throw new RituError("coisa_ruim", "detalhe")
    })
    const r = await rota(pedido())
    expect(r.status).toBe(400)
    expect(await r.json()).toEqual({ erro: "coisa_ruim" })
  })

  it("500 sem detalhe e registra o log", async () => {
    const { deps, container } = await comConta()
    const log = vi.spyOn(container.telemetry, "log")
    const rota = criarRota(deps, {}, async () => {
      throw new Error("segredo interno")
    })
    const r = await rota(pedido())
    expect(r.status).toBe(500)
    const texto = await r.text()
    expect(texto).not.toContain("segredo interno")
    expect(JSON.parse(texto)).toEqual({ erro: "erro_inesperado" })
    expect(log).toHaveBeenCalledWith("erro_inesperado")
  })

  it("200 com o JSON, entregando conta e corpo", async () => {
    const { deps, conta } = await comConta()
    const rota = criarRota(deps, { corpo: schema }, async (ctx) => ({
      id: ctx.conta.id,
      n: ctx.corpo.n,
    }))
    const r = await rota(pedido(JSON.stringify({ n: 3 })))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ id: conta.id, n: 3 })
  })

  it("GET sem opts.corpo não lê o corpo", async () => {
    const { deps } = await comConta()
    const rota = criarRota(deps, {}, async (ctx) => ({ corpo: ctx.corpo ?? null }))
    const r = await rota(new Request("http://x/api"))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ corpo: null })
  })
})
