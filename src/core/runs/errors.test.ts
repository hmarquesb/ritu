import { describe, expect, it } from "vitest"
import { RituError } from "../errors"
import { LlmError } from "./agent-runtime"
import { RunAbertoError, RunNaoContinuavelError } from "./errors"

describe("RunAbertoError", () => {
  it("é um RituError com código run_aberto", () => {
    const erro = new RunAbertoError()

    expect(erro).toBeInstanceOf(RituError)
    expect(erro.code).toBe("run_aberto")
  })

  it("tem mensagem em português", () => {
    expect(new RunAbertoError().message.length).toBeGreaterThan(0)
  })
})

describe("RunNaoContinuavelError", () => {
  it("é um RituError com código run_nao_continuavel", () => {
    const erro = new RunNaoContinuavelError()

    expect(erro).toBeInstanceOf(RituError)
    expect(erro.code).toBe("run_nao_continuavel")
  })
})

describe("LlmError", () => {
  it("guarda o código de falha do modelo", () => {
    const erro = new LlmError("rate_limit", "x")

    expect(erro).toBeInstanceOf(RituError)
    expect(erro.code).toBe("rate_limit")
  })
})
