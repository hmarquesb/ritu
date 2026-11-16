import { describe, expect, it } from "vitest"
import {
  FAMILIAS,
  FAMILIAS_MARCADAS,
  FAMILIAS_TRANSVERSAIS,
  MARCAS,
  TITULO_DA_FAMILIA,
} from "../../../evals/llm/tipos"

describe("famílias dos evals", () => {
  it("tem 18 famílias", () => {
    expect(FAMILIAS).toHaveLength(18)
  })

  it("marca 15 famílias, sem as transversais", () => {
    expect(FAMILIAS_MARCADAS).toHaveLength(15)
    for (const transversal of FAMILIAS_TRANSVERSAIS) {
      expect(FAMILIAS_MARCADAS).not.toContain(transversal)
    }
  })

  it("mantém a ordem de FAMILIAS nas marcadas", () => {
    const esperadas = FAMILIAS.filter(
      (f) => !(FAMILIAS_TRANSVERSAIS as readonly string[]).includes(f),
    )
    expect([...FAMILIAS_MARCADAS]).toEqual(esperadas)
  })

  it("tem um título para cada família", () => {
    for (const familia of FAMILIAS) {
      expect(TITULO_DA_FAMILIA[familia]).toEqual(expect.any(String))
      expect(TITULO_DA_FAMILIA[familia].length).toBeGreaterThan(0)
    }
    expect(Object.keys(TITULO_DA_FAMILIA)).toHaveLength(18)
  })
})

describe("marcas dos casos", () => {
  it("tem 8 marcas", () => {
    expect(MARCAS).toHaveLength(8)
  })
})
