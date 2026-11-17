import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { MARCA_RITU, RituError } from "@/core/errors"
import { LimiteError } from "@/core/limits/erros"
import { createContainer } from "@/infra/container"
import { criarRota, statusDoErro } from "./rota"

const quemPede = () => ({ ipHash: "h" })

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

  it("erro de outra cópia de RituError vira o status do código; Error sem code é 500", async () => {
    const { deps } = await comConta()
    class OutraCopia extends Error {
      readonly code = "run_nao_continuavel"
      readonly [MARCA_RITU] = true
    }
    class ErroDeDriver extends Error {
      readonly code = "ECONNREFUSED"
    }
    const a = await criarRota(deps, {}, async () => {
      throw new OutraCopia("d")
    })(pedido())
    expect(a.status).toBe(409)
    expect(await a.json()).toEqual({ erro: "run_nao_continuavel" })
    const b = await criarRota(deps, {}, async () => {
      throw new Error("x")
    })(pedido())
    expect(b.status).toBe(500)
    expect(await b.json()).toEqual({ erro: "erro_inesperado" })
    const log = vi.spyOn(deps.container.telemetry, "log")
    const c = await criarRota(deps, {}, async () => {
      throw new ErroDeDriver("x")
    })(pedido())
    expect(c.status).toBe(500)
    expect(await c.json()).toEqual({ erro: "erro_inesperado" })
    expect(log).toHaveBeenCalledWith("erro_inesperado")
  })

  it("401 sem sessão", async () => {
    const { container } = montar()
    const rota = criarRota(
      { contaDaSessao: async () => undefined, container, quemPede },
      {},
      async () => 1,
    )
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
    const rota = criarRota(
      { contaDaSessao: async () => conta.id, container, quemPede },
      {},
      async () => 1,
    )
    const r = await rota(pedido())
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ erro: "sem_sessao" })
  })

  async function comConta() {
    const m = montar()
    const conta = await m.stores.accounts.criar({ tipo: "google", google_sub: "s", email: "a@b.c" })
    const deps = { contaDaSessao: async () => conta.id, container: m.container, quemPede }
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

describe("statusDoErro", () => {
  it("mapeia os códigos para o status", () => {
    expect(statusDoErro("run_nao_encontrado")).toBe(404)
    for (const c of [
      "run_aberto",
      "run_nao_continuavel",
      "pergunta_expirada",
      "aprovacao_expirada",
      "run_pausado",
    ]) {
      expect(statusDoErro(c)).toBe(409)
    }
    expect(statusDoErro("qualquer_outro")).toBe(400)
  })

  it("criarRota responde 409 com run_aberto", async () => {
    vi.stubEnv("RITU_MODO", "e2e")
    const container = createContainer()
    const conta = await container.stores.accounts.criar({
      tipo: "google",
      google_sub: "s",
      email: "a@b.c",
    })
    const rota = criarRota(
      { contaDaSessao: async () => conta.id, container, quemPede },
      {},
      async () => {
        throw new RituError("run_aberto", "d")
      },
    )
    const r = await rota(new Request("http://x/api"))
    expect(r.status).toBe(409)
    expect(await r.json()).toEqual({ erro: "run_aberto" })
    vi.unstubAllEnvs()
  })
})

describe("limite de toques", () => {
  afterEach(() => vi.unstubAllEnvs())

  async function preparar(tester = false) {
    vi.stubEnv("RITU_MODO", "e2e")
    const container = createContainer()
    const conta = await container.stores.accounts.criar({
      tipo: "google",
      google_sub: "s",
      email: "a@b.c",
    })
    if (tester) await container.stores.accounts.marcar(conta.id, { tester: true })
    const deps = {
      contaDaSessao: async () => conta.id,
      container,
      quemPede: () => ({ ipHash: "h", teto: 0 }),
    }
    return { deps }
  }

  it("POST com teto 0 responde 429 limite_toques com Retry-After e não roda fn", async () => {
    const { deps } = await preparar()
    const fn = vi.fn(async () => 1)
    const r = await criarRota(deps, {}, fn)(pedido())
    expect(r.status).toBe(429)
    expect(await r.json()).toEqual({ erro: "limite_toques" })
    expect(Number(r.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1)
    expect(fn).not.toHaveBeenCalled()
  })

  it("tester não consome", async () => {
    const { deps } = await preparar(true)
    const fn = vi.fn(async () => 1)
    const r = await criarRota(deps, {}, fn)(pedido())
    expect(r.status).toBe(200)
    expect(fn).toHaveBeenCalled()
  })

  it("GET e limite nenhum não consomem", async () => {
    const { deps } = await preparar()
    const a = await criarRota(deps, {}, async () => 1)(new Request("http://x/api"))
    expect(a.status).toBe(200)
    const b = await criarRota(deps, { limite: "nenhum" }, async () => 1)(pedido())
    expect(b.status).toBe(200)
  })

  it("corpo inválido responde 400 sem consumir", async () => {
    const { deps } = await preparar()
    const r = await criarRota(deps, { corpo: schema }, async () => 1)(pedido("{quebrado"))
    expect(r.status).toBe(400)
  })

  it("LimiteError lançado por fn vira 429 com Retry-After", async () => {
    const { deps } = await preparar()
    const rota = criarRota(deps, { limite: "nenhum" }, async () => {
      throw new LimiteError("limite_ip", 30)
    })
    const r = await rota(pedido())
    expect(r.status).toBe(429)
    expect(r.headers.get("Retry-After")).toBe("30")
    expect(await r.json()).toEqual({ erro: "limite_ip" })
  })

  it("statusDoErro dá 429 aos quatro códigos de limite", () => {
    for (const c of ["limite_mensagens", "limite_demo", "limite_ip", "limite_toques"]) {
      expect(statusDoErro(c)).toBe(429)
    }
  })
})
