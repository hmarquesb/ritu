import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import { fraseDaEtapa, frasesDoRun } from "./etapas"

const textos = config.textosConversa.etapas

describe("fraseDaEtapa", () => {
  it.each([
    ["interprete", "", "entendendo"],
    ["guardrail", "", "cuidado"],
    ["tool", "clima.agora", "clima"],
    ["tool", "clima.proximas_horas", "clima"],
    ["tool", "casa.ler", "casa"],
    ["tool", "preferencias.ler", "lembrando"],
    ["tool", "historico.recente", "lembrando"],
    ["tool", "ayurveda.candidatos", "base"],
    ["tool", "resultado.registrar", "retorno"],
    ["validacao", "", "conferindo"],
    ["juiz", "", "revisando"],
    ["memoria", "", "memoria"],
  ] as const)("%s / %s vira a frase %s", (tipo, nome, chave) => {
    const frase = fraseDaEtapa({ tipo, nome })
    expect(frase).toEqual({ chave, texto: textos[chave] })
  })

  it.each([
    ["llm", ""],
    ["pergunta", ""],
    ["proposta", ""],
    ["aprovacao", ""],
    ["troca_de_modelo", ""],
    ["erro", ""],
    ["tool", "finalizar"],
    ["tool", "memoria.propor"],
  ] as const)("%s / %s não tem frase", (tipo, nome) => {
    expect(fraseDaEtapa({ tipo, nome })).toBeUndefined()
  })
})

describe("frasesDoRun", () => {
  it("mantém a ordem e tira só as repetições seguidas", () => {
    const etapas = [
      { tipo: "tool" as const, nome: "clima.agora" },
      { tipo: "tool" as const, nome: "clima.proximas_horas" },
      { tipo: "tool" as const, nome: "casa.ler" },
      { tipo: "tool" as const, nome: "clima.agora" },
    ]
    expect(frasesDoRun(etapas).map((f) => f.chave)).toEqual(["clima", "casa", "clima"])
  })

  it("pula as etapas sem frase", () => {
    const etapas = [
      { tipo: "interprete" as const, nome: "" },
      { tipo: "llm" as const, nome: "" },
      { tipo: "tool" as const, nome: "ayurveda.candidatos" },
      { tipo: "validacao" as const, nome: "" },
      { tipo: "tool" as const, nome: "finalizar" },
      { tipo: "juiz" as const, nome: "" },
    ]
    expect(frasesDoRun(etapas).map((f) => f.chave)).toEqual([
      "entendendo",
      "base",
      "conferindo",
      "revisando",
    ])
  })

  it("tira a repetição que fica seguida depois de pular uma etapa sem frase", () => {
    const etapas = [
      { tipo: "llm" as const, nome: "" },
      { tipo: "tool" as const, nome: "casa.ler" },
      { tipo: "pergunta" as const, nome: "" },
      { tipo: "tool" as const, nome: "casa.ler" },
      { tipo: "tool" as const, nome: "clima.agora" },
    ]
    expect(frasesDoRun(etapas).map((f) => f.chave)).toEqual(["casa", "clima"])
  })

  it("devolve lista vazia sem etapas", () => {
    expect(frasesDoRun([])).toEqual([])
  })
})
