import { describe, expect, it } from "vitest"
import { DOSHAS, DURABILIDADES, ESTADOS, GRUPOS, GUNAS, OPOSTO, RASAS, TEMAS_QUIZ } from "./vocab"

describe("vocabulário fechado", () => {
  it("GUNAS tem 12 qualidades", () => {
    expect(GUNAS).toHaveLength(12)
  })

  it("OPOSTO é simétrico para toda guna", () => {
    for (const guna of GUNAS) {
      expect(OPOSTO[OPOSTO[guna]]).toBe(guna)
      expect(OPOSTO[guna]).not.toBe(guna)
    }
  })

  it("mantém os conjuntos principais com os valores do contrato", () => {
    expect(RASAS).toEqual(["doce", "azedo", "salgado", "picante", "amargo", "adstringente"])
    expect(DOSHAS).toEqual(["vata", "pitta", "kapha"])
    expect(ESTADOS).toContain("sem_energia")
    expect(GRUPOS).toHaveLength(13)
    expect(DURABILIDADES).toEqual(["curta", "media", "longa"])
    expect(TEMAS_QUIZ).toHaveLength(8)
  })
})
