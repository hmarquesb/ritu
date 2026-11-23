import { describe, expect, it } from "vitest"
import type { Container } from "@/infra/container"
import { createFakeCities } from "@/infra/fakes/fake-cities"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { criarHandlerMcp, criarPostMcp } from "./servidor"

const URL_MCP = "http://localhost/api/mcp"
const CABECALHOS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  "x-forwarded-for": "1.2.3.4",
}

function montar() {
  const clock = createFixedClock("2026-01-15T15:00:00Z")
  const telemetry = createMemoryTelemetry()
  const limiter = createMemoryLimiter()
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
  return { container, handler, post, telemetry, limiter, clock }
}

function pedido(corpo: unknown, extra: Record<string, string> = {}): Request {
  return new Request(URL_MCP, {
    method: "POST",
    headers: { ...CABECALHOS, ...extra },
    body: JSON.stringify(corpo),
  })
}

type Corpo = {
  result: {
    isError?: boolean
    content: { text: string }[]
    structuredContent: { aviso?: string; status?: string }
    serverInfo: { name: string }
    tools: { name: string; inputSchema: unknown; outputSchema: unknown }[]
  }
}

async function rpc(post: (r: Request) => Promise<Response>, method: string, params?: unknown) {
  const r = await post(pedido({ jsonrpc: "2.0", id: 1, method, params }))
  const texto = await r.text()
  const linha = texto.startsWith("event:")
    ? (texto.split("\n").find((l) => l.startsWith("data:")) ?? "").slice(5)
    : texto
  return { status: r.status, corpo: JSON.parse(linha) as Corpo }
}

describe("servidor MCP", () => {
  it("initialize + tools/list devolvem as seis tools com inputSchema e outputSchema", async () => {
    const { post } = montar()
    const ini = await rpc(post, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "t", version: "1" },
    })
    expect(ini.corpo.result.serverInfo.name).toBe("ritu")
    const lista = await rpc(post, "tools/list", {})
    const tools = lista.corpo.result.tools
    expect(tools.map((t) => t.name).sort()).toEqual([
      "ayurveda_alimento",
      "ayurveda_candidatos",
      "ayurveda_checar_combinacao",
      "ayurveda_substitutos",
      "clima_agora",
      "clima_proximas_horas",
    ])
    for (const t of tools) {
      expect(t.inputSchema).toBeTruthy()
      expect(t.outputSchema).toBeTruthy()
    }
  })

  it("tools/call de ayurveda_alimento devolve structuredContent com aviso", async () => {
    const { post, telemetry } = montar()
    const r = await rpc(post, "tools/call", {
      name: "ayurveda_alimento",
      arguments: { alimentos: ["banana"] },
    })
    expect(r.corpo.result.isError).toBeFalsy()
    expect(r.corpo.result.structuredContent.aviso).toBe("Não é orientação médica.")
    expect(telemetry.spans.map((s) => s.nome)).toContain("mcp.tool")
    expect(telemetry.metricas).toContainEqual(
      expect.objectContaining({
        nome: "ritu_mcp_chamadas_total",
        rotulos: { tool: "ayurveda_alimento", resultado: "ok" },
      }),
    )
  })

  it("argumento inválido vira erro de tool com os campos, sem stack", async () => {
    const { post, telemetry } = montar()
    const r = await rpc(post, "tools/call", {
      name: "ayurveda_alimento",
      arguments: { alimentos: "banana" },
    })
    expect(r.corpo.result.isError).toBe(true)
    const texto = r.corpo.result.content[0]?.text ?? ""
    expect(texto).toContain("Entrada inválida.")
    expect(texto).toContain("alimentos")
    expect(texto).not.toContain("at ")
    expect(telemetry.metricas).toContainEqual(
      expect.objectContaining({ rotulos: { tool: "ayurveda_alimento", resultado: "invalido" } }),
    )
  })

  it("clima_agora com cidade fora do ar devolve indisponivel", async () => {
    const m = montar()
    ;(m.container.cities as ReturnType<typeof createFakeCities>).foraDoAr(true)
    const r = await rpc(m.post, "tools/call", {
      name: "clima_agora",
      arguments: { cidade: "Recife" },
    })
    expect(r.corpo.result.structuredContent.status).toBe("indisponivel")
  })

  it("a 31ª chamada do minuto é 429 com Retry-After e corpo JSON-RPC", async () => {
    const { post } = montar()
    for (let i = 0; i < 30; i++) {
      const r = await post(pedido({ jsonrpc: "2.0", id: i, method: "ping" }))
      expect(r.status).not.toBe(429)
    }
    const r = await post(pedido({ jsonrpc: "2.0", id: 99, method: "ping" }))
    expect(r.status).toBe(429)
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0)
    expect(await r.json()).toEqual({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Limite de uso atingido. Tente de novo mais tarde." },
      id: null,
    })
  })

  it("corpo acima de 16 KB é 413 e não consome limite", async () => {
    const m = montar()
    const grande = pedido({ jsonrpc: "2.0", id: 1, method: "ping", params: "x".repeat(17_000) })
    expect((await m.post(grande)).status).toBe(413)
    expect(await m.limiter.usado("mcp:global", "dia", "2026-01-15")).toBe(0)
  })

  it("GET não consome limite", async () => {
    const m = montar()
    const r = await m.handler(new Request(URL_MCP, { method: "GET", headers: CABECALHOS }))
    expect(r.status).toBe(405)
    expect(await m.limiter.usado("mcp:global", "dia", "2026-01-15")).toBe(0)
  })
})
