import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { RituError } from "@/core/errors"
import { createContainer } from "@/infra/container"
import { criarRotaDeFluxo } from "./fluxo"

function montar() {
  vi.stubEnv("RITU_MODO", "e2e")
  return createContainer()
}

async function comConta() {
  const container = montar()
  const conta = await container.stores.accounts.criar({
    tipo: "google",
    google_sub: "s",
    email: "a@b.c",
  })
  return { container, deps: { contaDaSessao: async () => conta.id, container } }
}

const pedido = (corpo?: string, h: Record<string, string> = {}) =>
  new Request("http://x/api", { method: "POST", body: corpo, headers: h })

const schema = z.object({ n: z.number() })

async function linhas(r: Response) {
  return (await r.text())
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
}

describe("criarRotaDeFluxo", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("401 sem sessão", async () => {
    const container = montar()
    const rota = criarRotaDeFluxo(
      { contaDaSessao: async () => undefined, container },
      {},
      async () => {},
    )
    const r = await rota(pedido())
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ erro: "sem_sessao" })
  })

  it("413 e 400 antes do fluxo", async () => {
    const { deps } = await comConta()
    const rota = criarRotaDeFluxo(deps, { corpo: schema }, async () => {})
    expect((await rota(pedido("{}", { "content-length": "999999" }))).status).toBe(413)
    const r = await rota(pedido("{quebrado"))
    expect(r.status).toBe(400)
    expect(await r.json()).toEqual({ erro: "corpo_invalido" })
  })

  it("RituError antes da primeira emissão vira JSON com status", async () => {
    const { deps } = await comConta()
    const rota = criarRotaDeFluxo(deps, {}, async () => {
      throw new RituError("run_aberto", "d")
    })
    const r = await rota(pedido())
    expect(r.status).toBe(409)
    expect(await r.json()).toEqual({ erro: "run_aberto" })
    const outra = criarRotaDeFluxo(deps, {}, async () => {
      throw new RituError("outro", "d")
    })
    expect((await outra(pedido())).status).toBe(400)
  })

  it("emite os eventos em ordem, uma linha cada, com os cabeçalhos", async () => {
    const { deps } = await comConta()
    const rota = criarRotaDeFluxo(deps, { corpo: schema }, async (ctx, emitir) => {
      emitir({ tipo: "inicio", run_id: `r${ctx.corpo.n}` })
      emitir({ tipo: "erro", erro: "x" })
    })
    const r = await rota(pedido(JSON.stringify({ n: 1 })))
    expect(r.status).toBe(200)
    expect(r.headers.get("content-type")).toBe("application/x-ndjson; charset=utf-8")
    expect(r.headers.get("cache-control")).toBe("no-store")
    expect(r.headers.get("x-accel-buffering")).toBe("no")
    expect(await linhas(r)).toEqual([
      { tipo: "inicio", run_id: "r1" },
      { tipo: "erro", erro: "x" },
    ])
  })

  it("RituError depois da emissão vira evento de erro e fecha", async () => {
    const { deps } = await comConta()
    const rota = criarRotaDeFluxo(deps, {}, async (_c, emitir) => {
      emitir({ tipo: "inicio", run_id: "r" })
      throw new RituError("run_pausado", "d")
    })
    const r = await rota(pedido())
    expect(r.status).toBe(200)
    expect(await linhas(r)).toEqual([
      { tipo: "inicio", run_id: "r" },
      { tipo: "erro", erro: "run_pausado" },
    ])
  })

  it("erro inesperado depois da emissão: erro_inesperado e log", async () => {
    const { deps, container } = await comConta()
    const log = vi.spyOn(container.telemetry, "log")
    const rota = criarRotaDeFluxo(deps, {}, async (_c, emitir) => {
      emitir({ tipo: "inicio", run_id: "r" })
      throw new Error("segredo")
    })
    const texto = await (await rota(pedido())).text()
    expect(texto).not.toContain("segredo")
    expect(texto).toContain('"erro":"erro_inesperado"')
    expect(log).toHaveBeenCalledWith("erro_inesperado")
  })

  it("cancelar o fluxo no meio não interrompe fn", async () => {
    const { deps } = await comConta()
    let terminou = false
    let liberar: () => void = () => {}
    const espera = new Promise<void>((r) => {
      liberar = r
    })
    const rota = criarRotaDeFluxo(deps, {}, async (_c, emitir) => {
      emitir({ tipo: "inicio", run_id: "r" })
      await espera
      emitir({ tipo: "erro", erro: "depois" })
      terminou = true
    })
    const r = await rota(pedido())
    const leitor = (r.body as ReadableStream).getReader()
    await leitor.read()
    await leitor.cancel()
    liberar()
    await vi.waitFor(() => expect(terminou).toBe(true))
  })
})
