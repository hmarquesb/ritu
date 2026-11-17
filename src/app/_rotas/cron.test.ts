import { after } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { executarLimpeza } from "@/core/cleanup"
import { type Container, createContainer } from "@/infra/container"
import { rotaDaLimpeza, rotaDosPadroes } from "./cron"

vi.mock("@/core/cleanup", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/core/cleanup")>()
  return { ...real, executarLimpeza: vi.fn(real.executarLimpeza) }
})

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}))

function montar() {
  vi.stubEnv("RITU_MODO", "e2e")
  return rotaDaLimpeza({ container: createContainer(), segredo: () => "segredo123" })
}

const pedido = (auth?: string, caminho = "limpeza") =>
  new Request(`http://x/api/cron/${caminho}`, {
    headers: auth ? { authorization: auth } : {},
  })

function containerDePadroes(
  detectar: () => Promise<unknown> = async () => ({ contas: 2, propostos: 1, falhas: 0 }),
  ligada = false,
) {
  const encerrar = vi.fn(async () => {})
  const log = vi.fn()
  const detectarPadroes = vi.fn(detectar)
  const container = {
    patterns: { detectarPadroes },
    telemetry: { log, encerrar },
    telemetriaLigada: ligada,
  } as unknown as Container
  return { container, detectar: detectarPadroes, log }
}

describe("rotaDaLimpeza", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.mocked(executarLimpeza).mockClear()
    vi.mocked(after).mockClear()
  })

  it("401 sem header, com segredo errado ou de outro tamanho", async () => {
    const rota = montar()
    for (const h of [undefined, "Bearer errado0123", "Bearer x", "segredo123"]) {
      const r = await rota(pedido(h))
      expect(r.status).toBe(401)
      expect(await r.json()).toEqual({ erro: "sem_autorizacao" })
    }
  })

  it("503 cron_desligado sem segredo, e a limpeza não roda", async () => {
    vi.stubEnv("RITU_MODO", "e2e")
    const rota = rotaDaLimpeza({ container: createContainer(), segredo: () => undefined })
    const r = await rota(pedido("Bearer segredo123"))
    expect(r.status).toBe(503)
    expect(await r.json()).toEqual({ erro: "cron_desligado" })
    expect(executarLimpeza).not.toHaveBeenCalled()
  })

  it("com o segredo certo devolve as contagens", async () => {
    const r = await montar()(pedido("Bearer segredo123"))
    expect(r.status).toBe(200)
    const corpo = await r.json()
    expect(corpo.limites).toBe(0)
    expect(corpo.demos).toBe(0)
  })

  it("com telemetria ligada, agenda a descarga depois da resposta", async () => {
    vi.stubEnv("RITU_MODO", "e2e")
    const container = Object.create(createContainer(), {
      telemetriaLigada: { value: true },
    }) as Container
    const rota = rotaDaLimpeza({ container, segredo: () => "segredo123" })
    await rota(pedido("Bearer segredo123"))
    expect(after).toHaveBeenCalledTimes(1)
  })
})

describe("rotaDosPadroes", () => {
  afterEach(() => {
    vi.mocked(after).mockClear()
  })

  it("401 nao_autorizado sem bearer, e a detecção não roda", async () => {
    const { container, detectar } = containerDePadroes()
    const rota = rotaDosPadroes({ container, segredo: () => "segredo123" })
    for (const h of [undefined, "Bearer errado0123"]) {
      const r = await rota(pedido(h, "padroes"))
      expect(r.status).toBe(401)
      expect(await r.json()).toEqual({ erro: "nao_autorizado" })
    }
    expect(detectar).not.toHaveBeenCalled()
  })

  it("503 cron_desligado sem segredo, e a detecção não roda", async () => {
    const { container, detectar } = containerDePadroes()
    const rota = rotaDosPadroes({ container, segredo: () => undefined })
    const r = await rota(pedido("Bearer segredo123", "padroes"))
    expect(r.status).toBe(503)
    expect(await r.json()).toEqual({ erro: "cron_desligado" })
    expect(detectar).not.toHaveBeenCalled()
  })

  it("com bearer devolve as contagens da detecção", async () => {
    const { container, detectar } = containerDePadroes()
    const rota = rotaDosPadroes({ container, segredo: () => "segredo123" })
    const r = await rota(pedido("Bearer segredo123", "padroes"))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ contas: 2, propostos: 1, falhas: 0 })
    expect(detectar).toHaveBeenCalledTimes(1)
  })

  it("detecção que lança vira 500 falhou, com log só do código", async () => {
    const { container, log } = containerDePadroes(async () => {
      throw new Error("texto que não pode ir para o log")
    })
    const rota = rotaDosPadroes({ container, segredo: () => "segredo123" })
    const r = await rota(pedido("Bearer segredo123", "padroes"))
    expect(r.status).toBe(500)
    expect(await r.json()).toEqual({ erro: "falhou" })
    expect(log).toHaveBeenCalledWith("erro_inesperado", { "erro.codigo": "desconhecido" })
  })

  it("com telemetria ligada, agenda a descarga depois da resposta", async () => {
    const { container } = containerDePadroes(undefined, true)
    const rota = rotaDosPadroes({ container, segredo: () => "segredo123" })
    await rota(pedido("Bearer segredo123", "padroes"))
    expect(after).toHaveBeenCalledTimes(1)
  })
})
