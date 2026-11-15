import { describe, expect, it } from "vitest"
import { notaAdequacao } from "./adequacao"

describe("notaAdequacao", () => {
  it("item com duas gunas buscadas pontua mais que item com uma", () => {
    const dois = notaAdequacao({ gunas: ["quente", "leve"] }, ["quente", "leve"])
    const um = notaAdequacao({ gunas: ["quente", "seco"] }, ["quente", "leve"])

    expect(dois.nota).toBeGreaterThan(um.nota)
    expect(dois.nota).toBe(4)
    expect(um.nota).toBe(2)
  })

  it("guna oposta a uma buscada pontua abaixo de um item neutro", () => {
    const oposto = notaAdequacao({ gunas: ["frio"] }, ["quente"])
    const neutro = notaAdequacao({ gunas: ["pesado"] }, ["quente"])

    expect(oposto.nota).toBeLessThan(neutro.nota)
    expect(oposto.nota).toBe(-2)
    expect(neutro.nota).toBe(0)
  })

  it("contribui lista só as gunas do item que estão em buscadas", () => {
    const r = notaAdequacao({ gunas: ["quente", "pesado"] }, ["quente", "leve"])

    expect(r.contribui).toEqual(["quente"])
  })

  it("sem prakriti, o efeito não muda a nota", () => {
    const semEfeito = notaAdequacao({ gunas: ["quente"] }, ["quente"])
    const comEfeito = notaAdequacao(
      { gunas: ["quente"], efeito: { vata: 2, pitta: 0, kapha: 0 } },
      ["quente"],
    )

    expect(comEfeito.nota).toBe(semEfeito.nota)
  })

  it("com prakriti { vata: 1 } e efeito.vata = 2, a nota cai 2", () => {
    const base = notaAdequacao({ gunas: ["quente"], efeito: { vata: 2, pitta: 0, kapha: 0 } }, [
      "quente",
    ])
    const comPrakriti = notaAdequacao(
      { gunas: ["quente"], efeito: { vata: 2, pitta: 0, kapha: 0 } },
      ["quente"],
      { vata: 1 },
    )

    expect(base.nota - comPrakriti.nota).toBe(2)
  })
})
