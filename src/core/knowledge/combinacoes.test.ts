import { describe, expect, it } from "vitest"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { checarCombinacao } from "./combinacoes"

const kb = createMiniKnowledge()

describe("checarCombinacao", () => {
  it("leite com fruta azeda acusa leite-fruta-azeda", () => {
    const r = checarCombinacao(["leite", "limao"], kb)
    expect(r.compativel).toBe(false)
    expect(r.conflitos).toEqual([
      {
        itens: ["alimento:leite", "marca:fruta_azeda"],
        motivo: "Leite com fruta azeda costuma pesar na digestão.",
        linha_base: "combinacoes:leite-fruta-azeda",
      },
    ])
  })

  it("leite com banana acusa leite-banana", () => {
    const r = checarCombinacao(["leite", "banana"], kb)
    expect(r.compativel).toBe(false)
    expect(r.conflitos.map((c) => c.linha_base)).toEqual(["combinacoes:leite-banana"])
  })

  it("a ordem dos ids não muda o conflito", () => {
    expect(checarCombinacao(["banana", "leite"], kb).conflitos.map((c) => c.linha_base)).toEqual([
      "combinacoes:leite-banana",
    ])
  })

  it("arroz-branco com abóbora é compatível", () => {
    expect(checarCombinacao(["arroz-branco", "abobora"], kb)).toEqual({
      compativel: true,
      conflitos: [],
    })
  })

  it("cada par conflitante entra uma vez", () => {
    const r = checarCombinacao(["leite", "limao", "banana"], kb)
    expect(r.conflitos.map((c) => c.linha_base).sort()).toEqual([
      "combinacoes:leite-banana",
      "combinacoes:leite-fruta-azeda",
    ])
  })

  it("um id só nunca conflita e ids desconhecidos são ignorados", () => {
    expect(checarCombinacao(["leite"], kb).compativel).toBe(true)
    expect(checarCombinacao(["leite", "nao-existe"], kb).compativel).toBe(true)
    expect(checarCombinacao([], kb).compativel).toBe(true)
  })
})
