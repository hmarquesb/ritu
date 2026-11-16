import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import type { NotaParaResumo } from "@/core/agents/memory/entrada"
import { resumoPorCodigo } from "@/core/agents/memory/resumo"

// Resumo por código (sem modelo): nunca passa do teto, fica com as notas mais recentes e as põe da mais recente para a mais antiga.
const TETO = config.memoria.resumoRotinaCaracteres
const BASE = Date.parse("2026-06-01T10:00:00.000Z")
const HORA = 3_600_000

// Nota de índice `i`: quanto maior o índice, mais recente.
function nota(texto: string, i: number): NotaParaResumo {
  return { texto, criado_em: new Date(BASE + i * HORA).toISOString() }
}

// Trinta notas longas e distintas: cada uma vira uma frase de 200 caracteres.
function trintaNotasLongas(): NotaParaResumo[] {
  return Array.from({ length: 30 }, (_, i) =>
    nota(`${String(i).padStart(2, "0")}${"a".repeat(197)}`, i),
  )
}

describe("resumo por código: o teto", () => {
  it("nunca passa do teto, nem com notas longas de sobra", () => {
    expect(resumoPorCodigo(trintaNotasLongas()).length).toBeLessThanOrEqual(TETO)
  })

  it("sem nota, o resumo é vazio", () => {
    expect(resumoPorCodigo([])).toBe("")
  })
})

describe("resumo por código: com notas demais, ficam as mais recentes", () => {
  it("o resumo começa pela nota mais recente e não traz a mais antiga", () => {
    const texto = resumoPorCodigo(trintaNotasLongas())

    expect(texto.startsWith("29")).toBe(true)
    expect(texto).toContain("25")
    expect(texto).not.toContain("00")
  })

  it("para na primeira nota que não cabe: as notas que entram são contíguas, da mais recente", () => {
    const texto = resumoPorCodigo(trintaNotasLongas())
    const numeros = texto.split(". ").map((frase) => Number(frase.slice(0, 2)))

    expect(numeros).toEqual([...numeros].sort((a, b) => b - a))
    expect(numeros.every((n, i) => i === 0 || numeros[i - 1] === n + 1)).toBe(true)
  })
})

describe("resumo por código: a ordem é da mais recente para a mais antiga", () => {
  it("três notas fora de ordem saem da mais recente para a mais antiga", () => {
    const texto = resumoPorCodigo([
      nota("primeira coisa", 1),
      nota("terceira coisa", 9),
      nota("segunda coisa", 5),
    ])

    expect(texto).toBe("Terceira coisa. Segunda coisa. Primeira coisa.")
  })

  it("não muda a lista de entrada ao ordenar", () => {
    const notas = [nota("primeira coisa", 1), nota("segunda coisa", 5)]

    resumoPorCodigo(notas)

    expect(notas.map((n) => n.texto)).toEqual(["primeira coisa", "segunda coisa"])
  })
})
