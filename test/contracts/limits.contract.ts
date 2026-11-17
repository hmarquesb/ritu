import { beforeEach, describe, expect, it } from "vitest"
import type { UsageLimiter } from "@/core/limits/ports"

export type AmbienteDoLimitador = { limiter: UsageLimiter; reset?: () => Promise<void> }

const MIN = "2026-11-16T12:00:00.000Z"
const DIA = "2026-11-16"

export function runLimitsContract(
  nome: string,
  make: () => Promise<AmbienteDoLimitador>,
  opcoes: { concorrencia?: boolean } = {},
): void {
  describe(`contrato: UsageLimiter (${nome})`, () => {
    let limiter: UsageLimiter

    beforeEach(async () => {
      const ambiente = await make()
      await ambiente.reset?.()
      limiter = ambiente.limiter
    })

    it("consome até o teto e a seguinte barra devolvendo a chave", async () => {
      const p = [{ chave: "a", teto: 2 }]
      expect(await limiter.consumir(p, "minuto", MIN)).toEqual({ ok: true })
      expect(await limiter.consumir(p, "minuto", MIN)).toEqual({ ok: true })
      expect(await limiter.consumir(p, "minuto", MIN)).toEqual({ ok: false, chave: "a" })
      expect(await limiter.usado("a", "minuto", MIN)).toBe(2)
    })

    it("com duas chaves e uma no teto, não soma em nenhuma", async () => {
      await limiter.consumir([{ chave: "b", teto: 1 }], "dia", DIA)
      const r = await limiter.consumir(
        [
          { chave: "a", teto: 5 },
          { chave: "b", teto: 1 },
        ],
        "dia",
        DIA,
      )
      expect(r).toEqual({ ok: false, chave: "b" })
      expect(await limiter.usado("a", "dia", DIA)).toBe(0)
      expect(await limiter.usado("b", "dia", DIA)).toBe(1)
    })

    it("devolve a primeira chave que barrou", async () => {
      await limiter.consumir(
        [
          { chave: "a", teto: 1 },
          { chave: "b", teto: 1 },
        ],
        "dia",
        DIA,
      )
      const r = await limiter.consumir(
        [
          { chave: "b", teto: 1 },
          { chave: "a", teto: 1 },
        ],
        "dia",
        DIA,
      )
      expect(r).toEqual({ ok: false, chave: "b" })
    })

    it("usado de chave nunca vista é 0", async () => {
      expect(await limiter.usado("nunca", "dia", DIA)).toBe(0)
    })

    it("janelas e inícios diferentes não se misturam", async () => {
      const p = [{ chave: "a", teto: 1 }]
      expect(await limiter.consumir(p, "minuto", MIN)).toEqual({ ok: true })
      expect(await limiter.consumir(p, "dia", DIA)).toEqual({ ok: true })
      expect(await limiter.consumir(p, "dia", "2026-11-17")).toEqual({ ok: true })
      expect(await limiter.usado("a", "minuto", MIN)).toBe(1)
      expect(await limiter.usado("a", "dia", DIA)).toBe(1)
      expect(await limiter.usado("a", "minuto", "2026-11-16T12:01:00.000Z")).toBe(0)
    })

    it("apagarAntesDe apaga só linhas dia com início menor e devolve a contagem", async () => {
      const p = [{ chave: "a", teto: 9 }]
      await limiter.consumir(p, "dia", "2026-11-14")
      await limiter.consumir(p, "dia", "2026-11-15")
      await limiter.consumir(p, "minuto", "2026-11-01T00:00:00.000Z")
      expect(await limiter.apagarAntesDe("2026-11-15")).toBe(1)
      expect(await limiter.usado("a", "dia", "2026-11-14")).toBe(0)
      expect(await limiter.usado("a", "dia", "2026-11-15")).toBe(1)
      expect(await limiter.usado("a", "minuto", "2026-11-01T00:00:00.000Z")).toBe(1)
    })

    it.runIf(opcoes.concorrencia ?? false)(
      "10 consumos concorrentes com teto 5 somam exatamente 5",
      async () => {
        const rs = await Promise.all(
          Array.from({ length: 10 }, () => limiter.consumir([{ chave: "c", teto: 5 }], "dia", DIA)),
        )
        expect(rs.filter((r) => r.ok)).toHaveLength(5)
        expect(await limiter.usado("c", "dia", DIA)).toBe(5)
      },
    )
  })
}
