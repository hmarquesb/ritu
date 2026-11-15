import { describe, expect, it } from "vitest"
import {
  type IntencaoInterpretada,
  intencaoInterpretadaSchema,
  type SaidaDoInterprete,
  saidaDoInterpreteSchema,
} from "./saida"

function saidaMinima(): SaidaDoInterprete {
  return {
    intencoes: [],
    estados: [],
    itens_casa: [],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  }
}

describe("saidaDoInterpreteSchema", () => {
  it("aceita uma saída mínima, com listas vazias e suspeito falso", () => {
    expect(saidaDoInterpreteSchema.safeParse(saidaMinima()).success).toBe(true)
  })

  it("aceita um estado e uma restrição que não existem na base, porque quem descarta é a normalização", () => {
    const saida = {
      ...saidaMinima(),
      intencoes: ["momento"],
      estados: ["estado-inventado"],
      restricoes: ["restricao-inventada"],
    }
    expect(saidaDoInterpreteSchema.safeParse(saida).success).toBe(true)
  })

  it("recusa intenção fora das nove", () => {
    const saida = { ...saidaMinima(), intencoes: ["compra"] }
    expect(saidaDoInterpreteSchema.safeParse(saida).success).toBe(false)
  })

  it("aceita cada uma das nove intenções", () => {
    const todas: IntencaoInterpretada[] = [
      "momento",
      "pergunta",
      "vida",
      "casa",
      "retorno",
      "evitar",
      "ajuda",
      "ofensa",
      "fora",
    ]
    for (const intencao of todas) {
      expect(intencaoInterpretadaSchema.safeParse(intencao).success).toBe(true)
    }
    expect(intencaoInterpretadaSchema.options).toHaveLength(9)
  })

  it("aceita alerta só como fisico ou emocional", () => {
    expect(saidaDoInterpreteSchema.safeParse({ ...saidaMinima(), alerta: "fisico" }).success).toBe(
      true,
    )
    expect(
      saidaDoInterpreteSchema.safeParse({ ...saidaMinima(), alerta: "emocional" }).success,
    ).toBe(true)
    expect(saidaDoInterpreteSchema.safeParse({ ...saidaMinima(), alerta: "leve" }).success).toBe(
      false,
    )
  })

  it("recusa pendente que não é inteiro", () => {
    const saida = {
      ...saidaMinima(),
      retorno: { resultado: "ajudou", pendente: 1.5 },
    }
    expect(saidaDoInterpreteSchema.safeParse(saida).success).toBe(false)
  })

  it("aceita retorno com pendente inteiro e sem pendente", () => {
    expect(
      saidaDoInterpreteSchema.safeParse({
        ...saidaMinima(),
        retorno: { resultado: "nao_fez", pendente: 2 },
      }).success,
    ).toBe(true)
    expect(
      saidaDoInterpreteSchema.safeParse({ ...saidaMinima(), retorno: { resultado: "ajudou" } })
        .success,
    ).toBe(true)
  })

  it("aceita itens de casa com tem e acabou, e recusa outra ação", () => {
    expect(
      saidaDoInterpreteSchema.safeParse({
        ...saidaMinima(),
        itens_casa: [
          { nome: "gengibre", acao: "tem" },
          { nome: "leite", acao: "acabou" },
        ],
      }).success,
    ).toBe(true)
    expect(
      saidaDoInterpreteSchema.safeParse({
        ...saidaMinima(),
        itens_casa: [{ nome: "gengibre", acao: "talvez" }],
      }).success,
    ).toBe(false)
  })
})
