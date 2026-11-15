import { describe, expect, it } from "vitest"
import { estadoDoItem } from "./estado"
import type { ItemDaCasa } from "./types"

const DIA = 86_400_000
const CONFIRMADO_EM = "2026-01-01T12:00:00.000Z"
const confirmadoHa = (dias: number) => new Date(Date.parse(CONFIRMADO_EM) + dias * DIA)

function item(parcial: Partial<ItemDaCasa> = {}): ItemDaCasa {
  return {
    id: "item-1",
    conta_id: "conta-1",
    alimento_id: "arroz",
    nome_livre: null,
    nome_normalizado: null,
    estado: "tem",
    sempre_tenho: false,
    confirmado_em: CONFIRMADO_EM,
    origem: "conversa",
    ...parcial,
  }
}

describe("estadoDoItem", () => {
  it("durabilidade curta: confirmado até 5 dias, incerto no 6º", () => {
    expect(estadoDoItem(item(), confirmadoHa(5), "curta")).toBe("confirmado")
    expect(estadoDoItem(item(), confirmadoHa(6), "curta")).toBe("incerto")
  })

  it("durabilidade média: confirmado até 14 dias, incerto no 15º", () => {
    expect(estadoDoItem(item(), confirmadoHa(14), "media")).toBe("confirmado")
    expect(estadoDoItem(item(), confirmadoHa(15), "media")).toBe("incerto")
  })

  it("durabilidade longa: confirmado até 90 dias, incerto no 91º", () => {
    expect(estadoDoItem(item(), confirmadoHa(90), "longa")).toBe("confirmado")
    expect(estadoDoItem(item(), confirmadoHa(91), "longa")).toBe("incerto")
  })

  it("durabilidade desconhecida segue a regra da média", () => {
    expect(estadoDoItem(item(), confirmadoHa(14), undefined)).toBe("confirmado")
    expect(estadoDoItem(item(), confirmadoHa(15), undefined)).toBe("incerto")
  })

  it("sempre_tenho nunca fica incerto", () => {
    expect(estadoDoItem(item({ sempre_tenho: true }), confirmadoHa(400), "curta")).toBe(
      "sempre_tenho",
    )
  })

  it("acabou vale antes de tudo, inclusive para sempre_tenho", () => {
    expect(estadoDoItem(item({ estado: "acabou" }), confirmadoHa(1), "longa")).toBe("acabou")
    expect(
      estadoDoItem(item({ estado: "acabou", sempre_tenho: true }), confirmadoHa(1), "longa"),
    ).toBe("acabou")
  })
})
