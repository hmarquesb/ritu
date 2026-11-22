import { describe, expect, it } from "vitest"
import { normalizarEmail } from "./email"

describe("normalizarEmail", () => {
  it("passa para minúsculas e tira espaços das pontas", () => {
    expect(normalizarEmail(" Ana@X.com ")).toBe("ana@x.com")
  })

  it("devolve e-mail já normalizado sem mudança", () => {
    expect(normalizarEmail("ana@x.com")).toBe("ana@x.com")
  })
})
