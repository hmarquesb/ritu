import { describe, expect, it } from "vitest"
import { RituError } from "../errors"
import { RunAbertoError } from "./errors"

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
