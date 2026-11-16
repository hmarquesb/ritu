import { describe, expect, it } from "vitest"
import { lerApontamentos, MOTIVOS_DO_JUIZ, saidaDoJuizSchema } from "./saida"

describe("saidaDoJuizSchema", () => {
  it("aceita um motivo livre, porque a validação de motivo fica em lerApontamentos", () => {
    const lido = saidaDoJuizSchema.safeParse({
      apontamentos: [{ motivo: "inventado", trecho: "x" }],
    })
    expect(lido.success).toBe(true)
  })

  it("recusa um campo a mais no nível da saída", () => {
    const lido = saidaDoJuizSchema.safeParse({ apontamentos: [], extra: 1 })
    expect(lido.success).toBe(false)
  })
})

describe("MOTIVOS_DO_JUIZ", () => {
  it("tem os onze motivos, nesta ordem", () => {
    expect(MOTIVOS_DO_JUIZ).toEqual([
      "promessa",
      "dosagem",
      "conselho",
      "evitar_sempre",
      "texto_diferente",
      "motivo_sem_base",
      "para_ter",
      "vulgar",
      "tom",
      "jargao",
      "saude_na_proposta",
    ])
  })
})

describe("lerApontamentos", () => {
  it("descarta o apontamento com motivo fora da lista", () => {
    expect(lerApontamentos({ apontamentos: [{ motivo: "inventado", trecho: "x" }] })).toEqual([])
  })

  it("mantém a ordem e os repetidos", () => {
    const lidos = lerApontamentos({
      apontamentos: [
        { motivo: "tom", trecho: "um" },
        { motivo: "jargao", trecho: "dois" },
        { motivo: "tom", trecho: "um" },
      ],
    })
    expect(lidos).toEqual([
      { motivo: "tom", trecho: "um" },
      { motivo: "jargao", trecho: "dois" },
      { motivo: "tom", trecho: "um" },
    ])
  })

  it("corta o trecho em 120 caracteres", () => {
    const [lido] = lerApontamentos({
      apontamentos: [{ motivo: "promessa", trecho: "a".repeat(200) }],
    })
    expect(lido?.trecho).toHaveLength(120)
  })

  it("corta por caractere, sem partir emoji", () => {
    const [lido] = lerApontamentos({
      apontamentos: [{ motivo: "promessa", trecho: "😀".repeat(130) }],
    })
    expect(Array.from(lido?.trecho ?? "")).toHaveLength(120)
    expect(lido?.trecho).toBe("😀".repeat(120))
  })
})
