import { describe, expect, it } from "vitest"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { consumirMcp } from "./mcp"

const INICIO = "2026-01-15T15:00:00Z" // 12h em São Paulo, início do minuto
const MEIA_NOITE_SP = new Date("2026-01-16T03:00:00Z") // 00h do dia seguinte em São Paulo

function montar() {
  const clock = createFixedClock(INICIO)
  const limiter = createMemoryLimiter()
  const telemetry = createMemoryTelemetry()
  return { clock, limiter, telemetry, deps: { limiter, clock, telemetry } }
}

describe("consumirMcp", () => {
  it("31ª chamada do mesmo IP no minuto é barrada com motivo minuto; a espera vai até o próximo minuto", async () => {
    const m = montar()
    for (let i = 0; i < 30; i++) {
      expect(await consumirMcp(m.deps, "ip1")).toEqual({ ok: true })
    }
    m.clock.advance(30_000)
    const r = await consumirMcp(m.deps, "ip1")
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.erro.code).toBe("limite_mcp")
    expect(r.erro.retryAfterS).toBe(30)
    expect(m.telemetry.metricas).toHaveLength(1)
    expect(m.telemetry.metricas[0]).toMatchObject({
      nome: "ritu_limite_total",
      valor: 1,
      rotulos: { tipo: "mcp", motivo: "minuto", resultado: "barrado" },
    })
  })

  it("301ª chamada do IP no dia é barrada com motivo ip; a espera vai até a meia-noite de São Paulo", async () => {
    const m = montar()
    // Uma chamada por minuto: fica no teto diário sem bater no de minuto.
    for (let i = 0; i < 300; i++) {
      expect(await consumirMcp(m.deps, "ip1")).toEqual({ ok: true })
      m.clock.advance(60_000)
    }
    const r = await consumirMcp(m.deps, "ip1")
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.erro.code).toBe("limite_mcp")
    const esperaEsperada = Math.ceil((MEIA_NOITE_SP.getTime() - m.clock.now().getTime()) / 1000)
    expect(r.erro.retryAfterS).toBe(esperaEsperada)
    expect(m.telemetry.metricas.at(-1)).toMatchObject({
      nome: "ritu_limite_total",
      rotulos: { tipo: "mcp", motivo: "ip", resultado: "barrado" },
    })
  })

  it("3001ª chamada do dia no total é barrada com motivo global, para qualquer IP", async () => {
    const m = montar()
    // 100 IPs, 30 chamadas cada no mesmo minuto: nenhum IP bate no seu teto.
    for (let ip = 0; ip < 100; ip++) {
      for (let i = 0; i < 30; i++) {
        expect(await consumirMcp(m.deps, `ip${ip}`)).toEqual({ ok: true })
      }
    }
    const r = await consumirMcp(m.deps, "ip-novo")
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.erro.code).toBe("limite_mcp")
    expect(m.telemetry.metricas.at(-1)).toMatchObject({
      nome: "ritu_limite_total",
      rotulos: { tipo: "mcp", motivo: "global", resultado: "barrado" },
    })
  })
})
