import { describe, expect, it } from "vitest"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { verbosDasGunas } from "./verbos"

const kb = createMiniKnowledge()

describe("verbosDasGunas", () => {
  it("devolve os verbos das gunas na ordem canônica de GUNAS", () => {
    expect(verbosDasGunas(["movel", "quente"], kb)).toEqual(["aquece", "estimula"])
  })

  it("pula gunas sem verbo", () => {
    expect(verbosDasGunas(["aspero", "frio"], kb)).toEqual(["refresca"])
  })

  it("lista vazia quando nenhuma guna tem verbo", () => {
    expect(verbosDasGunas(["aspero"], kb)).toEqual([])
    expect(verbosDasGunas([], kb)).toEqual([])
  })
})
