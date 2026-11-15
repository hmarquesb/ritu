import { describe, expect, it } from "vitest"
import { candidatosDaVaga } from "@/core/knowledge/filtros"
import { getContainer } from "@/infra/container"

const kb = getContainer().knowledge

const GRAOS = ["kitchari", "arroz-papa", "arroz-com-legume", "arroz-com-leguminosa"]
const PAO_E_DERIVADOS = /pao|macarrao|tapioca|farinha|cuscuz|polenta|torrada/
const ERVAS_SO_DE_CHA = ["camomila", "capim-limao", "erva-cidreira"]
const LACUNA_SEGUIDA_DE_ADJETIVO =
  /\}\s+(picad|cortad|ralad|amassad|fatiad|cozid|assad|refogad|picadinh)[oa]s?\b/

describe("vagas: alimentos aceitos por vaga na base real", () => {
  it.each(GRAOS)(
    "%s: a vaga base não aceita pão, massa, tapioca, farinha, cuscuz, polenta nem torrada",
    (id) => {
      const preparo = kb.preparo(id)
      expect(preparo, id).toBeDefined()
      const vagas = preparo?.vagas.filter((v) => v.funcao === "base") ?? []
      expect(vagas.length, id).toBeGreaterThan(0)
      for (const vaga of vagas) {
        const ids = candidatosDaVaga(vaga, kb).map((a) => a.id)
        expect(
          ids.filter((i) => PAO_E_DERIVADOS.test(i)),
          id,
        ).toEqual([])
      }
    },
  )

  it("nenhuma vaga tempero aceita erva só de chá", () => {
    for (const preparo of kb.preparos) {
      for (const vaga of preparo.vagas.filter((v) => v.funcao === "tempero")) {
        const ids = candidatosDaVaga(vaga, kb).map((a) => a.id)
        const proibidas = ids.filter((i) => ERVAS_SO_DE_CHA.includes(i))
        expect(proibidas, preparo.id).toEqual([])
      }
    }
  })

  it("mingau tem vaga liquido obrigatória, com opções só de alimentos com a função liquido", () => {
    const mingau = kb.preparo("mingau")
    const vaga = mingau?.vagas.find((v) => v.funcao === "liquido")
    expect(vaga?.obrigatoria).toBe(true)
    const opcoes = vaga ? candidatosDaVaga(vaga, kb) : []
    expect(opcoes.length).toBeGreaterThan(0)
    for (const alimento of opcoes) {
      expect(alimento.funcoes, alimento.id).toContain("liquido")
    }
  })

  it("nenhum passo tem lacuna seguida de adjetivo de preparo", () => {
    for (const preparo of kb.preparos) {
      expect(LACUNA_SEGUIDA_DE_ADJETIVO.test(preparo.passos), preparo.id).toBe(false)
    }
  })
})
