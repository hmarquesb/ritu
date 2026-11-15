import { describe, expect, it } from "vitest"
import type { Clima, PrevisaoHora } from "./ports"
import { tendenciaDasProximasHoras } from "./tendencia"

const OBSERVADO = "2026-01-15T12:00:00-03:00"

function hora(i: number, temperatura: number, prob = 0): PrevisaoHora {
  return {
    hora: `2026-01-15T${String(13 + i).padStart(2, "0")}:00:00-03:00`,
    temperatura_aparente: temperatura,
    prob_chuva: prob,
  }
}

function clima(temperaturaAgora: number, proximas: PrevisaoHora[]): Clima {
  return {
    temperatura_aparente: temperaturaAgora,
    umidade: 60,
    observado_em: OBSERVADO,
    proximas_horas: proximas,
  }
}

const seis = (temperatura: number, prob = 0) =>
  Array.from({ length: 6 }, (_, i) => hora(i, temperatura, prob))

describe("tendenciaDasProximasHoras", () => {
  it("+3 °C na sexta hora é esquenta", () => {
    const t = tendenciaDasProximasHoras(clima(24, [...seis(24).slice(0, 5), hora(5, 27)]))
    expect(t.temperatura).toBe("esquenta")
  })

  it("-3 °C na sexta hora é esfria", () => {
    const t = tendenciaDasProximasHoras(clima(24, [...seis(24).slice(0, 5), hora(5, 21)]))
    expect(t.temperatura).toBe("esfria")
  })

  it("+2.9 °C é estavel", () => {
    const t = tendenciaDasProximasHoras(clima(24, [...seis(24).slice(0, 5), hora(5, 26.9)]))
    expect(t.temperatura).toBe("estavel")
  })

  it("uma hora com 50% de chuva entre as consideradas dá chuva true", () => {
    const horas = seis(24)
    horas[3] = hora(3, 24, 50)
    expect(tendenciaDasProximasHoras(clima(24, horas)).chuva).toBe(true)
  })

  it("49% de chuva em todas as horas dá chuva false", () => {
    expect(tendenciaDasProximasHoras(clima(24, seis(24, 49))).chuva).toBe(false)
  })

  it("chuva só fora das 6 horas consideradas não conta", () => {
    const horas = [...seis(24), hora(6, 24, 90)]
    expect(tendenciaDasProximasHoras(clima(24, horas)).chuva).toBe(false)
  })

  it("com só 3 horas, compara com a terceira e informa ate dela", () => {
    const horas = [hora(0, 24), hora(1, 25), hora(2, 27)]
    const t = tendenciaDasProximasHoras(clima(24, horas))
    expect(t.temperatura).toBe("esquenta")
    expect(t.ate).toBe(horas[2]?.hora)
  })

  it("ate é a hora da última hora considerada", () => {
    const horas = seis(24)
    expect(tendenciaDasProximasHoras(clima(24, horas)).ate).toBe(horas[5]?.hora)
  })

  it("sem nenhuma hora dá estavel, sem chuva, com ate igual a observado_em", () => {
    expect(tendenciaDasProximasHoras(clima(24, []))).toEqual({
      temperatura: "estavel",
      chuva: false,
      ate: OBSERVADO,
    })
  })
})
