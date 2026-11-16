import { describe, expect, it } from "vitest"
import { mensagemDaNovaTentativa } from "./textos"

const CABECALHO = "Um revisor leu a sua resposta e ela não pode ser entregue assim. Problemas:"
const RODAPE =
  "Reescreva corrigindo só isso, sem mudar o que estava certo, e chame finalizar de novo."

describe("mensagemDaNovaTentativa", () => {
  it("traz só a linha da promessa quando vem junto com jargão", () => {
    const texto = mensagemDaNovaTentativa([
      { motivo: "promessa", trecho: "isso cura a gastrite" },
      { motivo: "jargao", trecho: "prana" },
    ])
    expect(texto).toBe(
      [
        CABECALHO,
        '- Promete efeito de saúde. Fale em conforto ("pode ajudar a aliviar a sensação de..."), nunca em tratar, curar ou resolver. Trecho: "isso cura a gastrite"',
        RODAPE,
      ].join("\n"),
    )
  })

  it("põe uma linha por apontamento grave, inclusive repetidos", () => {
    const texto = mensagemDaNovaTentativa([
      { motivo: "tom", trecho: "você deveria" },
      { motivo: "tom", trecho: "não pode continuar assim" },
    ])
    const linhas = texto.split("\n").filter((l) => l.startsWith("- "))
    expect(linhas).toHaveLength(2)
    expect(linhas[0]).toBe('- Cobra ou julga a pessoa. Reescreva acolhendo. Trecho: "você deveria"')
    expect(linhas[1]).toBe(
      '- Cobra ou julga a pessoa. Reescreva acolhendo. Trecho: "não pode continuar assim"',
    )
  })

  it("sai com o trecho literal quando ele tem $&", () => {
    const texto = mensagemDaNovaTentativa([{ motivo: "vulgar", trecho: "a $& b" }])
    expect(texto).toContain('Trecho: "a $& b"')
  })

  it("não troca marcadores que estão dentro do trecho", () => {
    const texto = mensagemDaNovaTentativa([{ motivo: "vulgar", trecho: "{descricao}" }])
    expect(texto).toContain('Trecho: "{descricao}"')
  })
})
