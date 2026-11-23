import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import { origemValida } from "@/core/security/origem"
import type { Container } from "@/infra/container"
import { createFakeCities } from "@/infra/fakes/fake-cities"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { criarHandlerMcp, criarPostMcp } from "@/infra/mcp/servidor"

// Rota do MCP: limites por IP e global, origem, corpo máximo, erro de tool e GET, com o handler real e tudo em memória.

const INICIO = "2026-01-15T15:00:00Z" // 12h em São Paulo, início do minuto
const DIA = "2026-01-15"
const { porIpPorMinuto, porIpPorDia, globalPorDia } = config.limites.mcp
const CAMINHO = config.bastidores.mcp.caminho

function montar() {
  const clock = createFixedClock(INICIO)
  const limiter = createMemoryLimiter()
  const telemetry = createMemoryTelemetry()
  const container = {
    knowledge: createMiniKnowledge(),
    weather: createFakeWeather(),
    cities: createFakeCities(),
    clock,
    telemetry,
    limiter,
  } as unknown as Container
  const handler = criarHandlerMcp(container)
  const post = criarPostMcp(container, handler, { segredo: () => "segredo", modoE2e: false })
  return { clock, limiter, handler, post }
}

function pedido(ip: string, corpo: unknown, metodo = "POST"): Request {
  return new Request(`http://localhost${CAMINHO}`, {
    method: metodo,
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "x-forwarded-for": ip,
    },
    ...(metodo === "POST" ? { body: JSON.stringify(corpo) } : {}),
  })
}

const ping = (id: number) => ({ jsonrpc: "2.0", id, method: "ping" })

describe("limites da rota do MCP", () => {
  it("a 31ª chamada do mesmo IP no minuto é 429 com Retry-After até o próximo minuto", async () => {
    const m = montar()
    for (let i = 0; i < porIpPorMinuto; i++) {
      expect((await m.post(pedido("1.1.1.1", ping(i)))).status).not.toBe(429)
    }
    m.clock.advance(20_000)
    const r = await m.post(pedido("1.1.1.1", ping(99)))
    expect(r.status).toBe(429)
    expect(r.headers.get("retry-after")).toBe("40")
    const corpo = await r.json()
    expect(corpo.error.message).toBe("Limite de uso atingido. Tente de novo mais tarde.")
    // Outro IP segue passando.
    expect((await m.post(pedido("2.2.2.2", ping(1)))).status).not.toBe(429)
  })

  it("a 301ª do dia do IP é 429 até a meia-noite de São Paulo", async () => {
    const m = montar()
    for (let i = 0; i < porIpPorDia; i++) {
      m.clock.advance(60_000)
      expect((await m.post(pedido("1.1.1.1", ping(i)))).status).not.toBe(429)
    }
    m.clock.advance(60_000)
    const r = await m.post(pedido("1.1.1.1", ping(999)))
    expect(r.status).toBe(429)
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(60)
  })

  it("a 3001ª do dia no total é 429 para todos", async () => {
    const m = montar()
    // Alimenta o contador global direto: cada IP fica abaixo do próprio teto.
    await m.limiter.consumir([{ chave: "mcp:global", teto: globalPorDia }], "dia", DIA)
    for (let i = 1; i < globalPorDia; i++) {
      await m.limiter.consumir([{ chave: "mcp:global", teto: globalPorDia }], "dia", DIA)
    }
    const r = await m.post(pedido("9.9.9.9", ping(1)))
    expect(r.status).toBe(429)
    expect(r.headers.get("retry-after")).toBeTruthy()
  })
})

describe("origem do MCP", () => {
  const base = { metodo: "POST", host: "ritu.test", caminho: CAMINHO }
  it("sem Origin passa; do próprio site passa; de outro site é 403", () => {
    expect(origemValida({ ...base, origin: null })).toBe(true)
    expect(origemValida({ ...base, origin: "https://ritu.test" })).toBe(true)
    expect(origemValida({ ...base, origin: "https://outro.test" })).toBe(false)
  })
  it("as demais rotas seguem exigindo Origin", () => {
    expect(origemValida({ ...base, caminho: "/api/conversa", origin: null })).toBe(false)
  })
})

describe("corpo, erro de tool e GET", () => {
  it("corpo acima do máximo é 413 e não consome", async () => {
    const m = montar()
    const grande = { ...ping(1), params: "x".repeat(config.bastidores.mcp.corpoMaximoBytes + 1) }
    expect((await m.post(pedido("1.1.1.1", grande))).status).toBe(413)
    expect(await m.limiter.usado("mcp:global", "dia", DIA)).toBe(0)
  })

  it("erro de tool não carrega stack", async () => {
    const m = montar()
    const r = await m.post(
      pedido("1.1.1.1", {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "ayurveda_alimento", arguments: { alimentos: 7 } },
      }),
    )
    const texto = await r.text()
    expect(texto).toContain("Entrada inválida.")
    expect(texto).not.toMatch(/\bat .*\(|node_modules|\.ts:\d+/)
  })

  it("GET não consome limite", async () => {
    const m = montar()
    const r = await m.handler(pedido("1.1.1.1", undefined, "GET"))
    expect(r.status).toBe(405)
    expect(await m.limiter.usado("mcp:global", "dia", DIA)).toBe(0)
  })
})
