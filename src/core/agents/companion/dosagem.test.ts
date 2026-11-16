import { describe, expect, it } from "vitest"
import { checarDosagem, temDosagem } from "./dosagem"
import type { EntregaDoModelo } from "./saida"

const cha: EntregaDoModelo["sugestoes"][number] = {
  tipo: "cha",
  pratica_id: "cha-gengibre",
  itens: [{ alimento_id: "gengibre", contribui: ["quente"], linha_base: "alimentos:gengibre" }],
  motivo: "Aquece o corpo.",
  linhas_base: ["praticas:cha-gengibre", "alimentos:gengibre"],
  novidade: false,
}

function entrega(mudar: Partial<EntregaDoModelo> = {}): EntregaDoModelo {
  return {
    resposta: "Um chá morno pode ajudar você a se sentir mais aquecida agora.",
    explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
    sugestoes: [cha],
    evitar: [],
    incertos: [],
    citados: [],
    ...mudar,
  }
}

describe("temDosagem", () => {
  it.each([
    "500 mg",
    "2 cápsulas",
    "suplemento de magnésio",
    "extrato de cúrcuma",
    "10 gotas",
    "tome 1 comprimido",
    "400 UI",
    "tintura de",
    "whey",
    "multivitamínico",
  ])("casa com %s", (texto) => {
    expect(temDosagem(texto)).toBe(true)
  })

  it.each([
    "1 colher de chá de gengibre",
    "200 ml de água",
    "uma pitada de sal",
    "uma xícara de chá",
  ])("não casa com %s", (texto) => {
    expect(temDosagem(texto)).toBe(false)
  })
})

describe("checarDosagem", () => {
  it("aponta dose na resposta, no motivo de uma sugestão e num incerto, com o onde de cada um", () => {
    const e = entrega({
      resposta: "Tome 500 mg de gengibre.",
      sugestoes: [{ ...cha, motivo: "Use 2 cápsulas à noite." }],
      incertos: ["Talvez um extrato de cúrcuma ajude."],
    })
    const violacoes = checarDosagem(e)
    expect(violacoes).toEqual([
      {
        codigo: "dosagem",
        onde: "resposta",
        mensagem: "Sem dose, suplemento ou fitoterápico: fale só de alimento, tempero e prática.",
      },
      {
        codigo: "dosagem",
        onde: "sugestoes[0].motivo",
        mensagem: "Sem dose, suplemento ou fitoterápico: fale só de alimento, tempero e prática.",
      },
      {
        codigo: "dosagem",
        onde: "incertos[0]",
        mensagem: "Sem dose, suplemento ou fitoterápico: fale só de alimento, tempero e prática.",
      },
    ])
  })

  it("entrega de hoje, sem dose, não aponta", () => {
    expect(checarDosagem(entrega())).toEqual([])
  })
})
