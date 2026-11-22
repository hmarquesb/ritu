import { after } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { type Container, createContainer } from "@/infra/container"
import { rotaDaSaude } from "./saude"

type Saude = Awaited<ReturnType<Container["saude"]>>

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}))

const SAUDE_OK: Saude = {
  versao: "teste",
  ambiente: "development",
  banco: "ok",
  migracao: "001_inicial",
  base: { alimentos: 3, preparos: 2, praticas: 1 },
  seed: "ok",
  telemetria: false,
  google: false,
}

const SAUDE_SEM_BANCO: Saude = { ...SAUDE_OK, banco: "falhou", migracao: null }

const pedido = (auth?: string) =>
  new Request("http://x/api/saude", { headers: auth ? { authorization: auth } : {} })

function containerDaSaude(saude: Saude, ligada = false) {
  const saudeFn = vi.fn(async () => saude)
  const container = {
    saude: saudeFn,
    telemetry: { log: vi.fn(), encerrar: vi.fn(async () => {}) },
    telemetriaLigada: ligada,
  } as unknown as Container
  return { container, saudeFn }
}

describe("rotaDaSaude", () => {
  afterEach(() => {
    vi.mocked(after).mockClear()
  })

  it("401 nao_autorizado sem bearer, e a leitura da saúde não roda", async () => {
    const { container, saudeFn } = containerDaSaude(SAUDE_OK)
    const rota = rotaDaSaude({ container, segredo: () => "segredo123" })
    for (const h of [undefined, "Bearer errado0123"]) {
      const r = await rota(pedido(h))
      expect(r.status).toBe(401)
      expect(await r.json()).toEqual({ erro: "nao_autorizado" })
    }
    expect(saudeFn).not.toHaveBeenCalled()
  })

  it("503 cron_desligado sem segredo, e a leitura da saúde não roda", async () => {
    const { container, saudeFn } = containerDaSaude(SAUDE_OK)
    const rota = rotaDaSaude({ container, segredo: () => undefined })
    const r = await rota(pedido("Bearer segredo123"))
    expect(r.status).toBe(503)
    expect(await r.json()).toEqual({ erro: "cron_desligado" })
    expect(saudeFn).not.toHaveBeenCalled()
  })

  it("com bearer e banco ok devolve 200 com o corpo Saude", async () => {
    const { container } = containerDaSaude(SAUDE_OK)
    const rota = rotaDaSaude({ container, segredo: () => "segredo123" })
    const r = await rota(pedido("Bearer segredo123"))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual(SAUDE_OK)
  })

  it("com bearer e banco falhou devolve 503 com o corpo Saude", async () => {
    const { container } = containerDaSaude(SAUDE_SEM_BANCO)
    const rota = rotaDaSaude({ container, segredo: () => "segredo123" })
    const r = await rota(pedido("Bearer segredo123"))
    expect(r.status).toBe(503)
    expect(await r.json()).toEqual(SAUDE_SEM_BANCO)
  })

  it("no modo e2e, com o container real, o banco aparece ok", async () => {
    vi.stubEnv("RITU_MODO", "e2e")
    const rota = rotaDaSaude({ container: createContainer(), segredo: () => "segredo123" })
    const r = await rota(pedido("Bearer segredo123"))
    expect(r.status).toBe(200)
    expect((await r.json()).banco).toBe("ok")
    vi.unstubAllEnvs()
  })

  it("com telemetria ligada, agenda a descarga depois da resposta", async () => {
    const { container } = containerDaSaude(SAUDE_OK, true)
    const rota = rotaDaSaude({ container, segredo: () => "segredo123" })
    await rota(pedido("Bearer segredo123"))
    expect(after).toHaveBeenCalledTimes(1)
  })
})
