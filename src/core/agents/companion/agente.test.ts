import { describe, expect, it } from "vitest"
import { acompanhanteV4 } from "@/core/agents/prompts/acompanhante.v4"
import { criarAcompanhante } from "./agente"

describe("criarAcompanhante", () => {
  it("tem as nove tools de leitura e as duas de proposta por último, e o controle é finalizar e ask_user, nessa ordem", () => {
    const a = criarAcompanhante()

    expect(a.nome).toBe("acompanhante")
    expect(a.tools).toHaveLength(11)
    expect(new Set(a.tools.map((t) => t.name)).size).toBe(11)
    expect(a.tools.slice(-2).map((t) => t.name)).toEqual(["memoria.propor", "lista.propor"])
    expect(a.controle.map((c) => c.name)).toEqual(["finalizar", "ask_user"])
    expect(a.prompt_versao).toBe(acompanhanteV4.versao)
    expect(a.instrucoes).toBe(acompanhanteV4.instrucoes)
    expect(a.lembreteDeEntrega).toBe(acompanhanteV4.lembreteDeEntrega)
  })
})
