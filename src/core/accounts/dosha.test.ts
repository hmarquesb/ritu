import { describe, expect, it } from "vitest"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { calcularQuiz, nomeDoDosha, prakritiDeclarada } from "./dosha"

const kb = createMiniKnowledge()

function repetir(dosha: "vata" | "pitta" | "kapha", n: number) {
  return Array.from({ length: n }, () => dosha)
}

function codigoDo(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (erro) {
    return (erro as { code?: string }).code
  }
  return undefined
}

function respostas(vata: number, pitta: number, kapha: number) {
  return [...repetir("vata", vata), ...repetir("pitta", pitta), ...repetir("kapha", kapha)]
}

describe("calcularQuiz", () => {
  it("8-0-0 dá um dosha só, com a prakriti de vata inteira", () => {
    const r = calcularQuiz(respostas(8, 0, 0))
    expect(r.doshas).toEqual(["vata"])
    expect(r.dual).toBe(false)
    expect(r.prakriti).toEqual({ vata: 1, pitta: 0, kapha: 0 })
  })

  it("4-3-1 é dual", () => {
    const r = calcularQuiz(respostas(4, 3, 1))
    expect(r.dual).toBe(true)
    expect(r.doshas).toEqual(["vata", "pitta"])
  })

  it("5-3-0 é simples, pela diferença de 2", () => {
    const r = calcularQuiz(respostas(5, 3, 0))
    expect(r.dual).toBe(false)
    expect(r.doshas).toEqual(["vata"])
  })

  it("3-3-2 é dual e o empate põe vata antes de pitta", () => {
    const r = calcularQuiz(respostas(3, 3, 2))
    expect(r.dual).toBe(true)
    expect(r.doshas).toEqual(["vata", "pitta"])
  })

  it("4-2-2 é simples", () => {
    const r = calcularQuiz(respostas(4, 2, 2))
    expect(r.dual).toBe(false)
    expect(r.doshas).toEqual(["vata"])
  })

  it("as proporções somam 1", () => {
    const r = calcularQuiz(respostas(4, 3, 1))
    const soma = Object.values(r.prakriti).reduce((a, b) => a + b, 0)
    expect(soma).toBeCloseTo(1, 10)
    expect(r.prakriti).toEqual({ vata: 0.5, pitta: 0.375, kapha: 0.125 })
  })

  it("sem respostas lança erro, em vez de devolver proporções inválidas", () => {
    expect(() => calcularQuiz([])).toThrow()
  })
})

describe("prakritiDeclarada", () => {
  it("um dosha vira 1 para ele", () => {
    expect(prakritiDeclarada(["pitta"])).toEqual({ pitta: 1 })
  })

  it("dois doshas viram 0.5 cada", () => {
    expect(prakritiDeclarada(["vata", "kapha"])).toEqual({ vata: 0.5, kapha: 0.5 })
  })

  it("zero doshas lança dosha_invalido", () => {
    expect(codigoDo(() => prakritiDeclarada([]))).toBe("dosha_invalido")
  })

  it("três doshas lançam dosha_invalido", () => {
    expect(codigoDo(() => prakritiDeclarada(["vata", "pitta", "kapha"]))).toBe("dosha_invalido")
  })

  it("repetido lança dosha_invalido", () => {
    expect(codigoDo(() => prakritiDeclarada(["vata", "vata"]))).toBe("dosha_invalido")
  })
})

describe("nomeDoDosha", () => {
  it("dois doshas empatados e próximos viram Vata-Pitta", () => {
    expect(nomeDoDosha({ vata: 0.45, pitta: 0.45, kapha: 0.1 }, kb)).toBe("Vata-Pitta")
  })

  it("um dosha só vira o nome dele", () => {
    expect(nomeDoDosha({ pitta: 1 }, kb)).toBe("Pitta")
  })

  it("diferença de 0.2 deixa só o primeiro", () => {
    expect(nomeDoDosha({ vata: 0.6, pitta: 0.4 }, kb)).toBe("Vata")
  })

  it("meio a meio vira Vata-Pitta", () => {
    expect(nomeDoDosha({ vata: 0.5, pitta: 0.5 }, kb)).toBe("Vata-Pitta")
  })
})
