import { describe, expect, it } from "vitest"
import { acompanhanteV3 } from "./acompanhante.v3"
import { acompanhanteV4 } from "./acompanhante.v4"

const v3Linhas = acompanhanteV3.instrucoes.split("\n")
const v4Linhas = acompanhanteV4.instrucoes.split("\n")

const LINHA_V3 = "- fato_de_rotina: leve em conta no que sugerir. Não diga que anotou."

const TRES_LINHAS = [
  "- fato_de_rotina: leve em conta no que sugerir. Se ele muda o que faz sentido para a pessoa por mais de um dia, chame memoria.propor. A nota só é guardada se ela aprovar: nunca diga que anotou.",
  '- lista.propor: só para um alimento que a pessoa respondeu "nao_tenho" nesta conversa e que faria diferença numa sugestão. No máximo um, com a sugestão a que ele faltou. Não use quando o contexto trouxer para_ter.',
  "- O que você propõe guardar aparece para a pessoa depois da sua resposta. Não fale das propostas no texto e não fale em comprar para resolver o momento.",
]

describe("acompanhanteV4", () => {
  it("tem a versão acompanhante.v4 e o mesmo lembrete da v3", () => {
    expect(acompanhanteV4.versao).toBe("acompanhante.v4")
    expect(acompanhanteV4.lembreteDeEntrega).toBe(acompanhanteV3.lembreteDeEntrega)
  })

  it("é a v3 com a linha de fato_de_rotina trocada pelas três linhas e nenhuma outra diferença", () => {
    expect(v3Linhas.indexOf(LINHA_V3)).toBeGreaterThan(-1)

    const desfeita = [...v4Linhas]
    const inicio = v4Linhas.indexOf(TRES_LINHAS[0] as string)
    expect(inicio).toBeGreaterThan(-1)
    desfeita.splice(inicio, TRES_LINHAS.length, LINHA_V3)

    expect(desfeita).toEqual(v3Linhas)
  })

  it("tem as três linhas novas, nesta ordem, logo no lugar da linha de fato_de_rotina", () => {
    const inicio = v4Linhas.indexOf(TRES_LINHAS[0] as string)

    expect(v4Linhas.slice(inicio, inicio + 3)).toEqual(TRES_LINHAS)
    expect(v4Linhas.filter((l) => l.startsWith("- fato_de_rotina:"))).toHaveLength(1)
  })
})
