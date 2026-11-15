import { describe, expect, it } from "vitest"
import { config } from "./index"

describe("config", () => {
  it("expõe o nome e o aviso do app", () => {
    expect(config.app.name).toBe("Ritu")
    expect(config.app.disclaimer).toBe("Não é orientação médica.")
  })
})
