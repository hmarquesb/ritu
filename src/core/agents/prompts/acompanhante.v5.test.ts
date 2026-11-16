import { describe, expect, it } from "vitest"
import { acompanhanteV4 } from "./acompanhante.v4"
import { acompanhanteV5 } from "./acompanhante.v5"

const v4Linhas = acompanhanteV4.instrucoes.split("\n")
const v5Linhas = acompanhanteV5.instrucoes.split("\n")

const LINHA_V4 =
  '- retorno: a pessoa contou como foi uma sugestão. Reconheça em uma frase. Com registrado false, diga que ela pode marcar em "Como ficou?". Nunca diga que anotou o que não foi registrado.'

const DUAS_LINHAS = [
  '- retorno: a pessoa contou como foi uma sugestão. Reconheça em uma frase. Com registrado true, já está anotado. Com registrado false, veja retornos_pendentes: se der para saber de qual sugestão ela fala, chame resultado.registrar com o número dela; se não der, diga que ela pode marcar em "Como ficou?". Nunca diga que anotou sem a tool ter devolvido registrado: true.',
  "- gosta_da_mensagem: alimentos de que a pessoa acabou de dizer que gosta. Já contam na ordem dos candidatos. Não diga que anotou.",
]

describe("acompanhanteV5", () => {
  it("tem a versão acompanhante.v5 e o mesmo lembrete da v4", () => {
    expect(acompanhanteV5.versao).toBe("acompanhante.v5")
    expect(acompanhanteV5.lembreteDeEntrega).toBe(acompanhanteV4.lembreteDeEntrega)
  })

  it("é a v4 com a linha de retorno trocada pelas duas linhas e nenhuma outra diferença", () => {
    expect(v4Linhas.indexOf(LINHA_V4)).toBeGreaterThan(-1)

    const desfeita = [...v5Linhas]
    const inicio = v5Linhas.indexOf(DUAS_LINHAS[0] as string)
    expect(inicio).toBeGreaterThan(-1)
    desfeita.splice(inicio, DUAS_LINHAS.length, LINHA_V4)

    expect(desfeita).toEqual(v4Linhas)
  })

  it("tem as duas linhas novas, nesta ordem, logo no lugar da linha de retorno", () => {
    const inicio = v5Linhas.indexOf(DUAS_LINHAS[0] as string)

    expect(v5Linhas.slice(inicio, inicio + 2)).toEqual(DUAS_LINHAS)
    expect(v5Linhas.filter((l) => l.startsWith("- retorno:"))).toHaveLength(1)
  })
})
