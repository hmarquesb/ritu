import { describe, expect, it } from "vitest"
import { llmCotas } from "./llm-cotas"

describe("llmCotas", () => {
  it("todo modelo citado em um papel existe em modelos", () => {
    for (const lista of Object.values(llmCotas.papeis)) {
      for (const modelo of lista) {
        expect(Object.keys(llmCotas.modelos)).toContain(modelo)
      }
    }
  })

  it("a primeira escolha de cada papel bate com a spec", () => {
    expect(llmCotas.papeis.decisao[0]).toBe("gemini-3.5-flash-lite")
    expect(llmCotas.papeis.apoio[0]).toBe("gemini-3.1-flash-lite")
    expect(llmCotas.papeis.reforco[0]).toBe("gemini-3.6-flash")
  })

  it("o dia da cota segue o fuso de Los Angeles e os limites da spec", () => {
    expect(llmCotas.fusoDoDia).toBe("America/Los_Angeles")
    expect(llmCotas.rateLimitsParaEsgotarODia).toBe(3)
    expect(llmCotas.timeoutMs).toBe(15_000)
    expect(llmCotas.modelos["gemini-3.5-flash-lite"]).toEqual({
      rpm: 15,
      tpm: 250_000,
      rpd: 500,
    })
  })
})
