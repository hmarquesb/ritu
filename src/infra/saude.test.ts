import { afterEach, describe, expect, it, vi } from "vitest"
import { ENV_VARS } from "@/infra/env"
import { type DepsDaSaude, lerSaude } from "./saude"

function deps(extra: Partial<DepsDaSaude> = {}): DepsDaSaude {
  return {
    env: {},
    consultarBanco: async () => {},
    ultimaMigracao: async () => "0009_x.sql",
    contagensDaBase: () => ({ alimentos: 3, preparos: 2, praticas: 1 }),
    lerSeed: () => {},
    google: () => true,
    ...extra,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe("lerSaude", () => {
  it("tudo ok", async () => {
    const saude = await lerSaude(
      deps({
        env: { RITU_VERSAO: "abc", VERCEL_ENV: "production", OTEL_EXPORTER_OTLP_ENDPOINT: "x" },
      }),
    )

    expect(saude).toEqual({
      versao: "abc",
      ambiente: "production",
      banco: "ok",
      migracao: "0009_x.sql",
      base: { alimentos: 3, preparos: 2, praticas: 1 },
      seed: "ok",
      telemetria: true,
      google: true,
    })
  })

  it("banco que lança: falhou, sem migração e sem a mensagem", async () => {
    const saude = await lerSaude(
      deps({
        consultarBanco: async () => {
          throw new Error("senha-secreta@host")
        },
      }),
    )

    expect(saude.banco).toBe("falhou")
    expect(saude.migracao).toBeNull()
    expect(JSON.stringify(saude)).not.toContain("senha-secreta")
  })

  it("banco que demora mais de 3 s falha", async () => {
    vi.useFakeTimers()
    const promessa = lerSaude(deps({ consultarBanco: () => new Promise(() => {}) }))
    await vi.advanceTimersByTimeAsync(3001)

    expect((await promessa).banco).toBe("falhou")
  })

  it("em memória, banco ok e migração nula", async () => {
    const saude = await lerSaude(
      deps({
        emMemoria: true,
        consultarBanco: async () => {
          throw new Error("x")
        },
      }),
    )

    expect(saude.banco).toBe("ok")
    expect(saude.migracao).toBeNull()
  })

  it("seed inválido", async () => {
    const saude = await lerSaude(
      deps({
        lerSeed: () => {
          throw new Error("ruim")
        },
      }),
    )

    expect(saude.seed).toBe("falhou")
  })

  it("ambiente desconhecido ou ausente vira development; versão ausente é null", async () => {
    expect((await lerSaude(deps())).ambiente).toBe("development")
    expect((await lerSaude(deps({ env: { VERCEL_ENV: "staging" } }))).ambiente).toBe("development")
    expect((await lerSaude(deps())).versao).toBeNull()
  })

  it("canário: nenhum valor de variável aparece", async () => {
    const env = Object.fromEntries(ENV_VARS.map((v) => [v.name, `valor-unico-${v.name}`]))
    const saude = await lerSaude(deps({ env }))
    const texto = JSON.stringify(saude)

    for (const v of ENV_VARS) {
      if (v.name === "RITU_VERSAO") continue
      expect(texto).not.toContain(env[v.name])
    }
    expect(saude.versao).toBe("valor-unico-RITU_VERSAO")
  })
})
