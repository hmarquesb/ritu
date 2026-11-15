import { describe, expect, it } from "vitest"
import { acompanhanteV3 } from "@/core/agents/prompts/acompanhante.v3"
import { criarAcompanhante } from "./agente"

describe("criarAcompanhante", () => {
  it("tem as nove tools de leitura, e o controle é finalizar e ask_user, nessa ordem", () => {
    const a = criarAcompanhante()

    expect(a.nome).toBe("acompanhante")
    expect(a.tools).toHaveLength(9)
    expect(new Set(a.tools.map((t) => t.name)).size).toBe(9)
    expect(a.controle.map((c) => c.name)).toEqual(["finalizar", "ask_user"])
    expect(a.prompt_versao).toBe(acompanhanteV3.versao)
    expect(a.instrucoes).toBe(acompanhanteV3.instrucoes)
    expect(a.lembreteDeEntrega).toBe(acompanhanteV3.lembreteDeEntrega)
  })
})
