import { describe, expect, it } from "vitest"
import { acompanhanteV1 } from "@/core/agents/prompts/acompanhante.v1"
import { criarAcompanhante } from "./agente"

describe("criarAcompanhante", () => {
  it("tem as nove tools de leitura e finalizar", () => {
    const a = criarAcompanhante()

    expect(a.nome).toBe("acompanhante")
    expect(a.tools).toHaveLength(9)
    expect(new Set(a.tools.map((t) => t.name)).size).toBe(9)
    expect(a.controle.map((c) => c.name)).toEqual(["finalizar"])
    expect(a.prompt_versao).toBe(acompanhanteV1.versao)
    expect(a.instrucoes).toBe(acompanhanteV1.instrucoes)
    expect(a.lembreteDeEntrega).toBe(acompanhanteV1.lembreteDeEntrega)
  })
})
