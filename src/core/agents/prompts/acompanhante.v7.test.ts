import { describe, expect, it } from "vitest"
import { acompanhanteV6 } from "./acompanhante.v6"
import { acompanhanteV7 } from "./acompanhante.v7"

const v6Linhas = acompanhanteV6.instrucoes.split("\n")
const v7Linhas = acompanhanteV7.instrucoes.split("\n")

const PADROES_V6 =
  "- padroes: regularidades que a pessoa confirmou. Quando um padrão fala do momento de agora e o que ele aponta está entre os candidatos, dê preferência a ele e diga isso em uma frase. Padrão não autoriza nada fora dos candidatos."

const PADROES_V7 =
  '- padroes: regularidades que a pessoa confirmou. Quando um padrão fala do momento de agora e o que ele aponta está entre os candidatos, dê preferência a ele e diga isso em uma frase. Quando o padrão fala de "um chá", escolha entre os chás candidatos o que casa com o momento e com a casa. Padrão não autoriza nada fora dos candidatos.'

describe("acompanhanteV7", () => {
  it("tem a versão acompanhante.v7 e o mesmo lembrete da v6", () => {
    expect(acompanhanteV7.versao).toBe("acompanhante.v7")
    expect(acompanhanteV7.lembreteDeEntrega).toBe(acompanhanteV6.lembreteDeEntrega)
  })

  it("é a v6 trocando só a linha de padroes", () => {
    const posV6 = v6Linhas.indexOf(PADROES_V6)
    expect(posV6).toBeGreaterThan(-1)

    const esperadas = [...v6Linhas]
    esperadas[posV6] = PADROES_V7

    expect(v7Linhas).toEqual(esperadas)
  })

  it("tem a linha de padroes nova, uma só vez, e sem a antiga", () => {
    expect(v7Linhas.filter((l) => l.startsWith("- padroes:"))).toEqual([PADROES_V7])
    expect(v7Linhas).not.toContain(PADROES_V6)
  })

  it("a linha nova fala de um chá e escolhe entre os chás candidatos", () => {
    expect(PADROES_V7).toContain('"um chá"')
    expect(PADROES_V7).toContain("chás candidatos")
  })
})
