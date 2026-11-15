import { describe, expect, it } from "vitest"
import { config } from "./index"

describe("config", () => {
  it("expõe o nome e o aviso do app", () => {
    expect(config.app.name).toBe("Ritu")
    expect(config.app.disclaimer).toBe("Não é orientação médica.")
  })

  it("expõe os limites da base e a adequação com os valores da spec", () => {
    expect(config.base.minAlimentos).toBe(130)
    expect(config.adequacao.porQualidadeOposta).toBe(-2)
  })

  it("expõe as faixas de horário com início e fim inclusivos", () => {
    expect(config.momentoDoDia.manha).toEqual({ inicio: 5, fim: 10 })
    expect(config.momentoDoDia.noite).toEqual({ inicio: 21, fim: 4 })
  })
})
