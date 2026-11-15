import { describe, expect, it } from "vitest"
import { config } from "./index"
import { ranking } from "./ranking"
import { resposta } from "./resposta"

describe("config do ranking", () => {
  it("tem os pesos e limites da spec", () => {
    expect(ranking.casa).toEqual({ confirmado: 3, incerto: 1 })
    expect(ranking.gosta).toBe(2)
    expect(ranking.porAjudou).toBe(1)
    expect(ranking.maximoDeAjudou).toBe(3)
    expect(ranking.porNaoAjudou).toBe(-1)
    expect(ranking.maximoDeNaoAjudou).toBe(2)
    expect(ranking.naoAjudouSeguidosParaOFim).toBe(2)
    expect(ranking.novidade).toEqual({ adequacaoMinima: 4, posicaoMaxima: 3 })
    expect(ranking.noContexto).toEqual({
      cha: 4,
      refeicao: 3,
      oleo: 2,
      pratica: 4,
      opcoesPorVaga: 3,
    })
    expect(ranking.faltas).toEqual({ maisAdequados: 5, minimoDeDias: 3, janelaDias: 30 })
  })

  it("tem os limites da resposta da spec e os expõe em config", () => {
    expect(resposta).toEqual({
      maxCaracteres: 900,
      maxSugestoes: 3,
      maxMotivo: 200,
      maxIncertos: 3,
      maxIncertoCaracteres: 120,
      maxCitados: 5,
      maxPensamento: 160,
      expressoesIgnoradas: ["cafe da manha"],
    })
    expect(config.ranking).toBe(ranking)
    expect(config.resposta).toBe(resposta)
  })
})
