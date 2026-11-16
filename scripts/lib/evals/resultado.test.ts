import { describe, expect, it } from "vitest"
import { LlmError } from "../../../src/core/llm/errors"
import { calcularAcertou, codigoDoErro } from "./resultado"

describe("calcularAcertou", () => {
  it("erra quando o caso tem erro, mesmo sem checagem falsa", () => {
    expect(
      calcularAcertou({
        checagens: [{ lista: "deve", descricao: "a", ok: true }],
        erro: "TypeError",
      }),
    ).toBe(false)
  })

  it("erra quando alguma checagem é false", () => {
    expect(
      calcularAcertou({
        checagens: [
          { lista: "deve", descricao: "a", ok: true },
          { lista: "nao_pode", descricao: "b", ok: false },
        ],
      }),
    ).toBe(false)
  })

  it("não derruba com checagem null (não avaliada)", () => {
    expect(calcularAcertou({ checagens: [{ lista: "criterio", descricao: "c", ok: null }] })).toBe(
      true,
    )
  })

  it("acerta com todas as checagens true", () => {
    expect(calcularAcertou({ checagens: [{ lista: "deve", descricao: "a", ok: true }] })).toBe(true)
  })

  it("acerta sem nenhuma checagem", () => {
    expect(calcularAcertou({ checagens: [] })).toBe(true)
  })
})

describe("codigoDoErro", () => {
  it("devolve LlmError:<código> para LlmError, sem a mensagem", () => {
    const erro = new LlmError("rate_limit", "segredo da mensagem")
    expect(codigoDoErro(erro)).toBe("LlmError:rate_limit")
  })

  it("devolve o nome da classe para outros erros", () => {
    expect(codigoDoErro(new TypeError("texto da pessoa"))).toBe("TypeError")
  })

  it("devolve desconhecido para o que não é Error", () => {
    expect(codigoDoErro("uma string")).toBe("desconhecido")
    expect(codigoDoErro(undefined)).toBe("desconhecido")
  })
})
