import { describe, expect, it } from "vitest"
import { acompanhanteV5 } from "./acompanhante.v5"
import { acompanhanteV6 } from "./acompanhante.v6"

const v5Linhas = acompanhanteV5.instrucoes.split("\n")
const v6Linhas = acompanhanteV6.instrucoes.split("\n")

const LINHA_FATO =
  "- fato_de_rotina: leve em conta no que sugerir. Se ele muda o que faz sentido para a pessoa por mais de um dia, chame memoria.propor. A nota só é guardada se ela aprovar: nunca diga que anotou."

const DUAS_LINHAS = [
  "- resumo_de_rotina: o que a pessoa já contou da rotina dela. Leve em conta no que sugerir e em quando sugerir. Não repita o resumo para ela.",
  "- padroes: regularidades que a pessoa confirmou. Quando um padrão fala do momento de agora e o que ele aponta está entre os candidatos, dê preferência a ele e diga isso em uma frase. Padrão não autoriza nada fora dos candidatos.",
]

describe("acompanhanteV6", () => {
  it("tem a versão acompanhante.v6 e o mesmo lembrete da v5", () => {
    expect(acompanhanteV6.versao).toBe("acompanhante.v6")
    expect(acompanhanteV6.lembreteDeEntrega).toBe(acompanhanteV5.lembreteDeEntrega)
  })

  it("é a v5 sem as duas linhas novas e nenhuma outra diferença", () => {
    const inicio = v6Linhas.indexOf(DUAS_LINHAS[0] as string)
    expect(inicio).toBeGreaterThan(-1)

    const semNovas = [...v6Linhas]
    semNovas.splice(inicio, DUAS_LINHAS.length)

    expect(semNovas).toEqual(v5Linhas)
  })

  it("tem as duas linhas novas, nesta ordem, logo depois da linha de fato_de_rotina", () => {
    const fato = v6Linhas.indexOf(LINHA_FATO)
    expect(fato).toBeGreaterThan(-1)

    expect(v6Linhas.slice(fato + 1, fato + 1 + DUAS_LINHAS.length)).toEqual(DUAS_LINHAS)
    expect(v6Linhas.filter((l) => l.startsWith("- resumo_de_rotina:"))).toHaveLength(1)
    expect(v6Linhas.filter((l) => l.startsWith("- padroes:"))).toHaveLength(1)
  })
})
