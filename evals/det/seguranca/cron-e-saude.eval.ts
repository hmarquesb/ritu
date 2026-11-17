import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { rotaDaLimpeza, rotaDosPadroes } from "@/app/_rotas/cron"
import { rotaDaSaude } from "@/app/_rotas/saude"
import { createContainer } from "@/infra/container"
import { ENV_VARS } from "@/infra/env"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryStores } from "@/infra/fakes/memory-stores"

const AGORA = new Date("2026-03-10T15:00:00.000Z")

// Valor único por variável: se ele aparece numa resposta, a variável vazou.
const canario = (nome: string): string => `canario-${nome.toLowerCase()}-8e21d4`
const bearerCerto = (): string => `Bearer ${canario("CRON_SECRET")}`

// Container em memória (modo e2e, sem banco nem rede). O RITU_MODO vale só na criação.
function montar() {
  vi.stubEnv("RITU_MODO", "e2e")
  const clock = { now: () => AGORA }
  const stores = createMemoryStores(clock)
  return createContainer({ clock, stores, tx: stores, limiter: createMemoryLimiter() })
}

function plantarCanarios(): void {
  for (const variavel of ENV_VARS) vi.stubEnv(variavel.name, canario(variavel.name))
}

function pedido(caminho: string, autorizacao?: string): Request {
  const headers = new Headers()
  if (autorizacao !== undefined) headers.set("authorization", autorizacao)
  return new Request(`http://x${caminho}`, { headers })
}

describe("cron e saúde sem segredo", () => {
  let rotas: ReturnType<typeof montarRotas>

  function montarRotas(container: ReturnType<typeof montar>) {
    const deps = { container, segredo: () => process.env.CRON_SECRET }
    return {
      padroes: rotaDosPadroes(deps),
      limpeza: rotaDaLimpeza(deps),
      saude: rotaDaSaude(deps),
    }
  }

  beforeEach(() => {
    rotas = montarRotas(montar())
    plantarCanarios()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe("/api/cron/padroes", () => {
    it("sem bearer → 401", async () => {
      const resposta = await rotas.padroes(pedido("/api/cron/padroes"))
      expect(resposta.status).toBe(401)
    })

    it("com bearer errado → 401", async () => {
      const resposta = await rotas.padroes(pedido("/api/cron/padroes", "Bearer errado"))
      expect(resposta.status).toBe(401)
    })

    it("com CRON_SECRET ausente → 503", async () => {
      vi.stubEnv("CRON_SECRET", "")
      const resposta = await rotas.padroes(pedido("/api/cron/padroes", bearerCerto()))
      expect(resposta.status).toBe(503)
    })

    it("com o bearer certo → 200", async () => {
      const resposta = await rotas.padroes(pedido("/api/cron/padroes", bearerCerto()))
      expect(resposta.status).toBe(200)
    })

    it("a resposta não traz valor de nenhuma variável", async () => {
      const corpo = await (await rotas.padroes(pedido("/api/cron/padroes", bearerCerto()))).text()
      for (const variavel of ENV_VARS) {
        expect(corpo, variavel.name).not.toContain(canario(variavel.name))
      }
    })
  })

  describe("/api/cron/limpeza", () => {
    it("sem bearer → 401", async () => {
      const resposta = await rotas.limpeza(pedido("/api/cron/limpeza"))
      expect(resposta.status).toBe(401)
    })

    it("com CRON_SECRET ausente → 503", async () => {
      vi.stubEnv("CRON_SECRET", "")
      const resposta = await rotas.limpeza(pedido("/api/cron/limpeza", bearerCerto()))
      expect(resposta.status).toBe(503)
    })
  })

  describe("/api/saude", () => {
    it("sem bearer → 401", async () => {
      const resposta = await rotas.saude(pedido("/api/saude"))
      expect(resposta.status).toBe(401)
    })

    it("com bearer errado → 401", async () => {
      const resposta = await rotas.saude(pedido("/api/saude", "Bearer errado"))
      expect(resposta.status).toBe(401)
    })

    it("com CRON_SECRET ausente → 503", async () => {
      vi.stubEnv("CRON_SECRET", "")
      const resposta = await rotas.saude(pedido("/api/saude", bearerCerto()))
      expect(resposta.status).toBe(503)
    })

    it("com o bearer certo → 200", async () => {
      const resposta = await rotas.saude(pedido("/api/saude", bearerCerto()))
      expect(resposta.status).toBe(200)
    })

    it("nas recusas, o corpo não traz valor de nenhuma variável", async () => {
      const semBearer = await (await rotas.saude(pedido("/api/saude"))).text()
      const bearerErrado = await (await rotas.saude(pedido("/api/saude", "Bearer errado"))).text()
      for (const corpo of [semBearer, bearerErrado]) {
        for (const variavel of ENV_VARS) {
          expect(corpo, variavel.name).not.toContain(canario(variavel.name))
        }
      }
    })

    it("com o bearer certo, só RITU_VERSAO aparece, em versao", async () => {
      const corpo = await (await rotas.saude(pedido("/api/saude", bearerCerto()))).text()
      const dados = JSON.parse(corpo) as { versao: unknown }
      expect(dados.versao).toBe(canario("RITU_VERSAO"))
      for (const variavel of ENV_VARS) {
        if (variavel.name === "RITU_VERSAO") continue
        expect(corpo, variavel.name).not.toContain(canario(variavel.name))
      }
    })
  })
})
