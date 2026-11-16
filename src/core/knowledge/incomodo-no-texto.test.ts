import { describe, expect, it } from "vitest"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { contemIncomodo } from "./incomodo-no-texto"

const kb = createMiniKnowledge()

describe("contemIncomodo", () => {
  it("acha uma palavra de incômodo da base com acento e maiúscula diferentes", () => {
    expect(contemIncomodo("ACORDO com CABEÇA latejando hoje", kb)).toBe(true)
  })

  it("não acha quando o texto não tem palavra de incômodo", () => {
    expect(contemIncomodo("Caminho antes do café", kb)).toBe(false)
  })

  it("texto vazio não contém incômodo", () => {
    expect(contemIncomodo("", kb)).toBe(false)
  })
})
