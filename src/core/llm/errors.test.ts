import { describe, expect, it } from "vitest"
import { RituError } from "@/core/errors"
import { LlmError } from "./errors"

describe("LlmError", () => {
  it("guarda o código de falha do modelo", () => {
    const erro = new LlmError("rate_limit", "x")

    expect(erro).toBeInstanceOf(RituError)
    expect(erro.code).toBe("rate_limit")
    expect(erro.name).toBe("LlmError")
  })
})
