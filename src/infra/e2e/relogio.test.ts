import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import type { Clock } from "@/core/clock"
import { momentoDoDia } from "@/core/knowledge/momento"
import { horaLocal } from "@/core/weather/hora-local"
import { createRelogioE2e } from "@/infra/e2e/relogio"

function real(inicio: string) {
  let ms = new Date(inicio).getTime()
  const relogio: Clock & { avancar(m: number): void } = {
    now: () => new Date(ms),
    avancar: (m) => {
      ms += m
    },
  }
  return relogio
}

describe("relógio do modo e2e", () => {
  it.each([
    ["2026-11-17T08:20:00Z"], // 05:20 em Brasília
    ["2026-11-17T15:00:00Z"], // 12:00
    ["2026-11-17T23:00:00Z"], // 20:00
  ])("a hora local de %s cai na noite", (inicio) => {
    const relogio = createRelogioE2e(real(inicio))
    const hora = horaLocal(relogio.now(), config.clima.fusoPadrao)
    expect(momentoDoDia(hora)).toBe("noite")
  })

  it("mantém minutos e segundos reais e o tempo decorrido real", () => {
    const base = real("2026-11-17T23:07:09Z")
    const relogio = createRelogioE2e(base)
    const a = relogio.now()
    expect(a.getUTCMinutes()).toBe(7)
    expect(a.getUTCSeconds()).toBe(9)
    base.avancar(90_000)
    expect(relogio.now().getTime() - a.getTime()).toBe(90_000)
  })

  it("volta para a noite quando o tempo real sai da faixa", () => {
    const base = real("2026-11-17T23:00:00Z")
    const relogio = createRelogioE2e(base)
    relogio.now()
    base.avancar(6 * 3_600_000)
    const hora = horaLocal(relogio.now(), config.clima.fusoPadrao)
    expect(momentoDoDia(hora)).toBe("noite")
  })
})
