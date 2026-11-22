import { describe, expect, it } from "vitest"
import { autorizarCron } from "./_autorizar"

describe("autorizarCron", () => {
  it("503 cron_desligado sem segredo ou com segredo vazio", () => {
    for (const segredo of [undefined, ""]) {
      expect(autorizarCron("Bearer segredo123", segredo)).toEqual({
        ok: false,
        status: 503,
        erro: "cron_desligado",
      })
    }
  })

  it("401 nao_autorizado sem cabeçalho, com segredo errado, sobra ou caixa diferente", () => {
    for (const cabecalho of [
      null,
      "Bearer errado0123",
      "Bearer segredo123x",
      "bearer segredo123",
    ]) {
      expect(autorizarCron(cabecalho, "segredo123")).toEqual({
        ok: false,
        status: 401,
        erro: "nao_autorizado",
      })
    }
  })

  it("401 quando o cabeçalho é só o segredo, sem Bearer", () => {
    expect(autorizarCron("segredo123", "segredo123")).toEqual({
      ok: false,
      status: 401,
      erro: "nao_autorizado",
    })
  })

  it("ok com Bearer <segredo>", () => {
    expect(autorizarCron("Bearer segredo123", "segredo123")).toEqual({ ok: true })
  })
})
