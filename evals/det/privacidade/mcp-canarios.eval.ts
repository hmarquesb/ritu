import { afterEach, describe, expect, it, vi } from "vitest"
import type { Container } from "@/infra/container"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { criarHandlerMcp, criarPostMcp } from "@/infra/mcp/servidor"

// Privacidade do MCP: a cidade e os nomes de alimento pedidos nunca saem em span, métrica, log nem console.

const CANARIO_CIDADE = "zibelina"
const CANARIO_ALIMENTO = "quarzo7"
const CANARIOS = [CANARIO_CIDADE, CANARIO_ALIMENTO]

const cidadeCanario = {
  nome: CANARIO_CIDADE,
  regiao: "RJ",
  pais: "Brasil",
  lat: -22.9,
  lon: -43.2,
  fuso: "America/Sao_Paulo",
}

type Cidades = Container["cities"]

function montar(cidades: Cidades) {
  const telemetry = createMemoryTelemetry()
  const container = {
    knowledge: createMiniKnowledge(),
    weather: createFakeWeather(),
    cities: cidades,
    clock: createFixedClock("2026-01-15T15:00:00Z"),
    telemetry,
    limiter: createMemoryLimiter(),
  } as unknown as Container
  const post = criarPostMcp(container, criarHandlerMcp(container), {
    segredo: () => "segredo",
    modoE2e: false,
  })
  return { telemetry, post }
}

const CHAMADAS: { name: string; arguments: Record<string, unknown> }[] = [
  { name: "ayurveda_alimento", arguments: { alimentos: [CANARIO_ALIMENTO, "banana"] } },
  { name: "ayurveda_candidatos", arguments: { tipo: "alimento", buscadas: ["quente"] } },
  { name: "ayurveda_substitutos", arguments: { alimento_id: CANARIO_ALIMENTO } },
  { name: "ayurveda_checar_combinacao", arguments: { itens: [CANARIO_ALIMENTO, "banana"] } },
  { name: "clima_agora", arguments: { cidade: CANARIO_CIDADE } },
  { name: "clima_proximas_horas", arguments: { cidade: CANARIO_CIDADE } },
]

afterEach(() => vi.restoreAllMocks())

async function rodar(cidades: Cidades) {
  const saidaDoConsole: string[] = []
  for (const metodo of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, metodo).mockImplementation((...args: unknown[]) => {
      saidaDoConsole.push(args.map(String).join(" "))
    })
  }
  const { telemetry, post } = montar(cidades)
  let id = 0
  for (const chamada of CHAMADAS) {
    await post(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "x-forwarded-for": "1.2.3.4",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: ++id,
          method: "tools/call",
          params: chamada,
        }),
      }),
    )
  }
  const emitido = JSON.stringify([
    telemetry.spans,
    telemetry.eventos,
    telemetry.metricas,
    telemetry.logs,
    saidaDoConsole,
  ]).toLowerCase()
  return { emitido, spans: telemetry.spans.length }
}

describe("canários do MCP", () => {
  it("cidade achada: nada do que a pessoa pediu sai na telemetria nem no console", async () => {
    const { emitido, spans } = await rodar({ buscar: async () => [cidadeCanario] })
    expect(spans).toBe(CHAMADAS.length)
    for (const c of CANARIOS) expect(emitido).not.toContain(c)
  })

  it("busca de cidade com erro inesperado: o log leva só o código", async () => {
    const { emitido } = await rodar({
      buscar: async () => {
        throw Object.assign(new Error(`falhou em ${CANARIO_CIDADE}`), { code: "cidades_quebrou" })
      },
    })
    expect(emitido).toContain("erro_inesperado")
    for (const c of CANARIOS) expect(emitido).not.toContain(c)
  })
})
