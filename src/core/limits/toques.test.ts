import { describe, expect, it } from "vitest"
import type { Conta } from "@/core/accounts/types"
import type { ModelRouter } from "@/core/llm/router"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { chavesDeToque } from "./chaves"
import { consumirToque } from "./toques"

const INICIO = "2026-01-15T15:00:00Z" // 12h em São Paulo

function conta(extra: Partial<Conta> = {}): Conta {
  return {
    id: "c1",
    tipo: "google",
    google_sub: "sub",
    email: "a@b.c",
    expira_em: null,
    tester: false,
    aviso_aceito_em: null,
    evitar_passo: null,
    evitar_lembrete_em: null,
    dosha_adiado_em: null,
    criado_em: "2026-01-10T12:00:00Z",
    ...extra,
  }
}

// O consumo de toque não usa o roteador de modelos; o campo existe só para cumprir DepsDosLimites.
const ROTEADOR_NAO_USADO = {} as ModelRouter

function montar() {
  const clock = createFixedClock(INICIO)
  const limiter = createMemoryLimiter()
  const telemetry = createMemoryTelemetry()
  return {
    clock,
    limiter,
    telemetry,
    deps: { limiter, router: ROTEADOR_NAO_USADO, clock, telemetry },
  }
}

describe("consumirToque", () => {
  it("61º toque no mesmo minuto é barrado; retryAfterS vai até o próximo minuto", async () => {
    const m = montar()
    const quem = { conta: conta(), ipHash: "hash1", fuso: "America/Sao_Paulo" }
    for (let i = 0; i < 60; i++) {
      expect(await consumirToque(m.deps, quem)).toEqual({ ok: true })
    }
    m.clock.advance(30_000)
    const r = await consumirToque(m.deps, quem)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.erro.code).toBe("limite_toques")
    expect(r.erro.retryAfterS).toBe(30)
    expect(m.telemetry.metricas).toHaveLength(1)
    expect(m.telemetry.metricas[0]).toMatchObject({
      nome: "ritu_limite_total",
      valor: 1,
      rotulos: { tipo: "toque", motivo: "minuto", resultado: "barrado" },
    })
  })

  it("301º toque do dia é barrado; retryAfterS vai até a meia-noite de São Paulo", async () => {
    const m = montar()
    const quem = { conta: conta(), ipHash: "hash1", fuso: "America/Sao_Paulo" }
    const inicio = new Date(INICIO).getTime()
    // Um toque por minuto: fica no teto diário sem bater no de minuto.
    for (let i = 0; i < 300; i++) {
      m.clock.set(new Date(inicio + i * 60_000).toISOString())
      expect(await consumirToque(m.deps, quem)).toEqual({ ok: true })
    }
    m.clock.set(new Date(inicio + 300 * 60_000).toISOString()) // 17h em São Paulo
    const r = await consumirToque(m.deps, quem)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.erro.code).toBe("limite_toques")
    expect(r.erro.retryAfterS).toBe(7 * 3600) // 17h até 24h
    expect(m.telemetry.metricas.at(-1)?.rotulos).toEqual({
      tipo: "toque",
      motivo: "dia",
      resultado: "barrado",
    })
  })

  it("IP com teto reduzido barra com motivo ip, mesmo com a conta dentro do limite", async () => {
    const m = montar()
    const a = { conta: conta({ id: "a" }), ipHash: "ip1", fuso: "America/Sao_Paulo", teto: 2 }
    const b = { conta: conta({ id: "b" }), ipHash: "ip1", fuso: "America/Sao_Paulo", teto: 2 }
    expect(await consumirToque(m.deps, a)).toEqual({ ok: true })
    expect(await consumirToque(m.deps, a)).toEqual({ ok: true })
    const r = await consumirToque(m.deps, b)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.erro.code).toBe("limite_toques")
    expect(m.telemetry.metricas.at(-1)?.rotulos).toEqual({
      tipo: "toque",
      motivo: "ip",
      resultado: "barrado",
    })
  })

  it("tester nunca barra, não consome e não soma métrica", async () => {
    const m = montar()
    const quem = {
      conta: conta({ tester: true }),
      ipHash: "hash1",
      fuso: "America/Sao_Paulo",
      teto: 1,
    }
    for (let i = 0; i < 5; i++) {
      expect(await consumirToque(m.deps, quem)).toEqual({ ok: true })
    }
    const { minuto, dia, ip } = chavesDeToque(quem.conta, quem.ipHash, m.clock.now())
    expect(await m.limiter.usado(minuto.chave, "minuto", minuto.inicio ?? "")).toBe(0)
    expect(await m.limiter.usado(dia.chave, "dia", dia.inicio ?? "")).toBe(0)
    expect(await m.limiter.usado(ip.chave, "dia", ip.inicio ?? "")).toBe(0)
    expect(m.telemetry.metricas).toEqual([])
  })

  it("métrica de limite leva só os rótulos tipo, motivo e resultado, sem IP, hash nem conta", async () => {
    const m = montar()
    const quem = { conta: conta(), ipHash: "segredo-hash", fuso: "America/Sao_Paulo", teto: 1 }
    await consumirToque(m.deps, quem)
    await consumirToque(m.deps, quem)
    const rotulos = m.telemetry.metricas.map((x) => x.rotulos)
    expect(rotulos).toHaveLength(1)
    expect(Object.keys(rotulos[0] ?? {}).sort()).toEqual(["motivo", "resultado", "tipo"])
    expect(JSON.stringify(rotulos)).not.toContain("segredo-hash")
    expect(JSON.stringify(rotulos)).not.toContain("c1")
  })
})
