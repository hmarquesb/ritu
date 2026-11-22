import { llmCotas } from "@config/llm-cotas"
import { beforeEach, describe, expect, it } from "vitest"
import type { Limites, UsageLedger } from "@/core/llm/ledger"
import { createFixedClock } from "../../src/infra/fakes/fixed-clock"

type RelogioDeTeste = ReturnType<typeof createFixedClock>

export type AmbienteDoLedger = { ledger: UsageLedger; limpar?: () => Promise<void> }

const M = llmCotas.papeis.decisao[0]
const MINUTO = 60_000
const HORA = 60 * MINUTO
const DIA = 24 * HORA
const folgado: Limites = { rpm: 100, tpm: 1_000_000, rpd: 1000 }

export function runUsageLedgerContract(
  nome: string,
  montar: (clock: RelogioDeTeste) => Promise<AmbienteDoLedger> | AmbienteDoLedger,
): void {
  describe(`contrato: UsageLedger (${nome})`, () => {
    let clock: RelogioDeTeste
    let ledger: UsageLedger

    beforeEach(async () => {
      clock = createFixedClock("2026-01-15T12:00:30Z")
      const ambiente = await montar(clock)
      await ambiente.limpar?.()
      ledger = ambiente.ledger
    })

    async function usoDe(modelo: string) {
      const todos = await ledger.uso()
      return todos.find((u) => u.modelo === modelo)
    }

    it("reservar soma 1 pedido nas duas janelas", async () => {
      expect(await ledger.reservar(M, folgado)).toBe(true)
      const uso = await usoDe(M)
      expect(uso?.minuto.pedidos).toBe(1)
      expect(uso?.dia.pedidos).toBe(1)
      expect(uso?.esgotado_ate).toBeUndefined()
    })

    it("com rpm cheio dá false, não soma no dia e volta no minuto seguinte", async () => {
      const limites = { ...folgado, rpm: 2 }
      expect(await ledger.reservar(M, limites)).toBe(true)
      expect(await ledger.reservar(M, limites)).toBe(true)
      expect(await ledger.reservar(M, limites)).toBe(false)
      expect((await usoDe(M))?.dia.pedidos).toBe(2)
      clock.advance(MINUTO)
      expect(await ledger.reservar(M, limites)).toBe(true)
      const uso = await usoDe(M)
      expect(uso?.minuto.pedidos).toBe(1)
      expect(uso?.dia.pedidos).toBe(3)
    })

    it("tpm: com tokens acima do limite no minuto, reservar dá false", async () => {
      const limites = { ...folgado, tpm: 1000 }
      expect(await ledger.reservar(M, limites)).toBe(true)
      await ledger.registrarTokens(M, 1500)
      expect(await ledger.reservar(M, limites)).toBe(false)
      clock.advance(MINUTO)
      expect(await ledger.reservar(M, limites)).toBe(true)
    })

    it("rpd cheio dá false até a virada do dia da cota, mesmo trocando de minuto", async () => {
      const limites = { ...folgado, rpd: 2 }
      expect(await ledger.reservar(M, limites)).toBe(true)
      expect(await ledger.reservar(M, limites)).toBe(true)
      clock.advance(5 * MINUTO)
      expect(await ledger.reservar(M, limites)).toBe(false)
      // 12:05 UTC é 04:05 em LA; a meia-noite de LA é 08:00 UTC do dia seguinte.
      clock.set("2026-01-15T23:00:00Z")
      expect(await ledger.reservar(M, limites)).toBe(false)
      clock.set("2026-01-16T07:59:00Z")
      expect(await ledger.reservar(M, limites)).toBe(false)
      clock.set("2026-01-16T08:01:00Z")
      expect(await ledger.reservar(M, limites)).toBe(true)
    })

    it("registrarRateLimit esgota o minuto, que volta no seguinte; o terceiro do dia esgota o dia", async () => {
      await ledger.registrarRateLimit(M)
      expect((await usoDe(M))?.esgotado_ate).toBe("minuto")
      expect(await ledger.reservar(M, folgado)).toBe(false)
      clock.advance(MINUTO)
      expect((await usoDe(M))?.esgotado_ate).toBeUndefined()
      expect(await ledger.reservar(M, folgado)).toBe(true)

      await ledger.registrarRateLimit(M)
      expect((await usoDe(M))?.esgotado_ate).toBe("minuto")
      clock.advance(MINUTO)
      await ledger.registrarRateLimit(M)
      const uso = await usoDe(M)
      expect(uso?.esgotado_ate).toBe("dia")
      expect(uso?.dia.rate_limits).toBe(3)
      clock.advance(10 * MINUTO)
      expect(await ledger.reservar(M, folgado)).toBe(false)
    })

    it("registrarTokens sem reserva anterior soma assim mesmo", async () => {
      await ledger.registrarTokens(M, 120)
      const uso = await usoDe(M)
      expect(uso?.minuto.tokens).toBe(120)
      expect(uso?.dia.tokens).toBe(120)
      expect(uso?.minuto.pedidos).toBe(0)
    })

    it("20 reservas concorrentes com rpm 15 dão exatamente 15 true", async () => {
      const limites = { ...folgado, rpm: 15 }
      const resultados = await Promise.all(
        Array.from({ length: 20 }, () => ledger.reservar(M, limites)),
      )
      expect(resultados.filter(Boolean)).toHaveLength(15)
      expect((await usoDe(M))?.minuto.pedidos).toBe(15)
    })

    it("apagarAntigas: minuto de 25 h sai e de 23 h fica", async () => {
      await ledger.registrarTokens("modelo-a", 1)
      clock.advance(2 * HORA)
      await ledger.registrarTokens("modelo-b", 1)
      clock.advance(23 * HORA)
      expect(await ledger.apagarAntigas()).toBe(1)
      expect(await ledger.apagarAntigas()).toBe(0)
      clock.advance(2 * HORA)
      expect(await ledger.apagarAntigas()).toBe(1)
    })

    it("apagarAntigas: dia de 31 dias sai e de 29 fica; conta os minutos também", async () => {
      await ledger.registrarTokens("modelo-a", 1)
      clock.advance(2 * DIA)
      await ledger.registrarTokens("modelo-b", 1)
      clock.advance(29 * DIA)
      // saem: minuto de a, minuto de b e dia de a
      expect(await ledger.apagarAntigas()).toBe(3)
      expect(await ledger.apagarAntigas()).toBe(0)
      clock.advance(2 * DIA)
      // sai: dia de b
      expect(await ledger.apagarAntigas()).toBe(1)
    })

    it("uso lista também os ids de rota que já têm registro", async () => {
      expect((await ledger.uso()).map((u) => u.modelo)).not.toContain(`${M}@2`)
      expect(await ledger.reservar(`${M}@2`, folgado)).toBe(true)
      await ledger.registrarTokens(`${M}@2`, 5)
      const uso = await usoDe(`${M}@2`)
      expect(uso?.dia.pedidos).toBe(1)
      expect(uso?.minuto.tokens).toBe(5)
      expect((await usoDe(M))?.dia.pedidos).toBe(0)
    })
  })
}
