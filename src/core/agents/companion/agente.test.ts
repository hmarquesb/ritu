import { describe, expect, it } from "vitest"
import { acompanhanteV2 } from "@/core/agents/prompts/acompanhante.v2"
import { criarAcompanhante } from "./agente"

describe("criarAcompanhante", () => {
  it("tem as nove tools de leitura e finalizar", () => {
    const a = criarAcompanhante()

    expect(a.nome).toBe("acompanhante")
    expect(a.tools).toHaveLength(9)
    expect(new Set(a.tools.map((t) => t.name)).size).toBe(9)
    expect(a.controle.map((c) => c.name)).toEqual(["finalizar"])
    expect(a.prompt_versao).toBe(acompanhanteV2.versao)
    expect(a.instrucoes).toBe(acompanhanteV2.instrucoes)
    expect(a.lembreteDeEntrega).toBe(acompanhanteV2.lembreteDeEntrega)
  })
})
