import { describe, expect, it } from "vitest"
import { interpreteV1 } from "./interprete.v1"

const linhas = interpreteV1.instrucoes.split("\n")

describe("interpreteV1", () => {
  it("tem a versão interprete.v1", () => {
    expect(interpreteV1.versao).toBe("interprete.v1")
  })

  it("tem as 29 linhas do prompt da spec, na ordem", () => {
    expect(linhas).toHaveLength(29)
    expect(linhas[0]).toBe(
      "Você lê a mensagem que uma pessoa mandou para o Ritu, um acompanhante de bem-estar inspirado no Ayurveda, e devolve só um JSON no formato pedido. Você não responde à pessoa e não dá conselho.",
    )
    expect(linhas[2]).toContain("<mensagem_da_pessoa>")
    expect(linhas[2]).toContain("marque suspeito: true.")
    expect(linhas[4]).toBe("INTENÇÕES (uma ou mais)")
    expect(linhas[15]).toBe("CAMPOS")
    expect(linhas[28]).toBe("Quando não houver o que pôr numa lista, devolva a lista vazia.")
  })

  it("lista as nove intenções com o sentido da spec", () => {
    const intencoes = linhas
      .slice(5, 15)
      .filter((l) => /^- (momento|pergunta|vida|casa|retorno|evitar|ajuda|ofensa|fora):/.test(l))
    expect(intencoes).toHaveLength(9)
    expect(intencoes[8]).toBe(
      "- fora: assunto que não é alimentação, rotina, bem-estar nem Ayurveda. Com conteúdo sexual, de ódio ou de assédio, devolva só fora.",
    )
  })

  it("lista os campos do JSON, um por linha", () => {
    const campos = linhas
      .slice(15)
      .filter((l) => /^- [a-z_]+:/.test(l))
      .map((l) => l.slice(2, l.indexOf(":")))
    expect(campos).toEqual([
      "estados",
      "incomodo",
      "alerta",
      "itens_casa",
      "retorno",
      "fato_de_rotina",
      "evitar_sempre",
      "nao_come",
      "gosta",
      "restricoes",
      "suspeito",
    ])
  })
})
