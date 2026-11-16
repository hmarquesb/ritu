import { describe, expect, it } from "vitest"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { resumoPorCodigo, validarResumo } from "./resumo"
import { saidaDaMemoriaSchema } from "./saida"

const kb = createMiniKnowledge()
const TETO = 1200

function nota(texto: string, dia: number) {
  const d = String(dia).padStart(2, "0")
  return { texto, criado_em: `2026-11-${d}T10:00:00.000Z` }
}

describe("saidaDaMemoriaSchema", () => {
  it("aceita só o campo resumo", () => {
    expect(saidaDaMemoriaSchema.safeParse({ resumo: "Você almoça fora." }).success).toBe(true)
    expect(saidaDaMemoriaSchema.safeParse({ resumo: "x", extra: 1 }).success).toBe(false)
  })
})

describe("resumoPorCodigo", () => {
  it("sem nota, devolve texto vazio", () => {
    expect(resumoPorCodigo([])).toBe("")
  })

  it("com uma nota, põe a primeira letra maiúscula e um ponto final", () => {
    expect(resumoPorCodigo([nota("você almoça fora durante a semana", 3)])).toBe(
      "Você almoça fora durante a semana.",
    )
  })

  it("não acrescenta ponto a nota que já termina em ponto", () => {
    expect(resumoPorCodigo([nota("você dorme cedo.", 3)])).toBe("Você dorme cedo.")
  })

  it("com três notas, a mais recente vem primeiro", () => {
    const texto = resumoPorCodigo([
      nota("primeira coisa", 1),
      nota("terceira coisa", 9),
      nota("segunda coisa", 5),
    ])

    expect(texto).toBe("Terceira coisa. Segunda coisa. Primeira coisa.")
  })

  it("com muitas notas longas, nunca passa do teto e traz as mais recentes", () => {
    const notas = Array.from({ length: 30 }, (_, i) => nota(`${"a".repeat(199)}${i}`, i + 1))

    const texto = resumoPorCodigo(notas)

    expect(texto.length).toBeLessThanOrEqual(TETO)
    expect(texto.startsWith("A")).toBe(true)
    expect(texto).toContain("29.")
    expect(texto).not.toContain("0.")
  })
})

describe("validarResumo", () => {
  it("apara e junta espaços e quebras de linha num espaço só", () => {
    expect(validarResumo("  a\n\n b  ", kb)).toBe("a b")
  })

  it("texto vazio é inválido", () => {
    expect(validarResumo("   ", kb)).toBeUndefined()
  })

  it("texto com mais de 1200 caracteres é inválido", () => {
    expect(validarResumo("a".repeat(1201), kb)).toBeUndefined()
  })

  it("texto com palavra de incômodo da base é inválido", () => {
    expect(validarResumo("Você acorda com cabeça latejando.", kb)).toBeUndefined()
  })
})
