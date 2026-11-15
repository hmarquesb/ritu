import { describe, expect, it } from "vitest"
import { validarBase } from "@/core/knowledge/knowledge-base"
import type { DadosDaBase } from "@/core/knowledge/schemas"
import { miniDados } from "@/infra/fakes/mini-knowledge"
import { formatBaseReport } from "./base-report"

const limpo = validarBase(miniDados, { cobertura: false })

function comAlimentoAConfirmar(): DadosDaBase {
  const [primeiro, ...resto] = miniDados.alimentos
  if (!primeiro) throw new Error("mini-base sem alimentos")
  return {
    ...miniDados,
    alimentos: [
      { ...primeiro, confianca: "baixa", fontes: [{ ref: "a_confirmar", campos: ["virya"] }] },
      ...resto,
    ],
  }
}

function comFonteNaoAprovada(): DadosDaBase {
  return {
    ...miniDados,
    fontes: miniDados.fontes.map((fonte) => ({ ...fonte, aprovada: false })),
  }
}

describe("formatBaseReport", () => {
  it("mostra as contagens por arquivo, por grupo e por tipo de prática", () => {
    const { lines } = formatBaseReport(limpo, miniDados, false)
    const texto = lines.join("\n")

    expect(texto).toContain("alimentos: 16")
    expect(texto).toContain("preparos: 4")
    expect(texto).toContain("praticas: 6")
    expect(texto).toContain("combinacoes: 2")
    expect(texto).toMatch(/Alimentos por grupo:/)
    expect(texto).toMatch(/Práticas por tipo:/)
    expect(texto).toContain("Linhas com a_confirmar: 0")
  })

  it("sem erros sai com 0 e diz Erros: nenhum", () => {
    const { lines, exitCode } = formatBaseReport(limpo, miniDados, false)

    expect(exitCode).toBe(0)
    expect(lines).toContain("Erros: nenhum")
  })

  it("com um erro sai com 1 e lista o erro", () => {
    const comErro = { ...limpo, erros: ["alimentos.yaml:ervilha: virya inválida"] }

    const { lines, exitCode } = formatBaseReport(comErro, miniDados, false)

    expect(exitCode).toBe(1)
    expect(lines.join("\n")).toContain("alimentos.yaml:ervilha: virya inválida")
    expect(lines).not.toContain("Erros: nenhum")
  })

  it("em modo produção com linha a_confirmar sai com 1 e conta a linha", () => {
    const dados = comAlimentoAConfirmar()
    const resultado = validarBase(dados, { cobertura: false })

    const { lines, exitCode } = formatBaseReport(resultado, dados, true)

    expect(exitCode).toBe(1)
    expect(lines.join("\n")).toContain("Linhas com a_confirmar: 1")
    expect(lines.join("\n")).toMatch(/1 linha\(s\) com a_confirmar/)
  })

  it("sem o modo produção, linha a_confirmar não falha", () => {
    const dados = comAlimentoAConfirmar()
    const resultado = validarBase(dados, { cobertura: false })

    const { exitCode } = formatBaseReport(resultado, dados, false)

    expect(exitCode).toBe(0)
  })

  it("em modo produção com fonte não aprovada sai com 1 e conta a fonte", () => {
    const dados = comFonteNaoAprovada()
    const resultado = validarBase(dados, { cobertura: false })

    const { lines, exitCode } = formatBaseReport(resultado, dados, true)

    expect(exitCode).toBe(1)
    expect(lines.join("\n")).toMatch(/1 fonte\(s\) não aprovada\(s\)/)
  })

  it("em modo produção limpo sai com 0", () => {
    const { lines, exitCode } = formatBaseReport(limpo, miniDados, true)

    expect(exitCode).toBe(0)
    expect(lines.join("\n")).toMatch(/Modo produção: sem bloqueios/)
  })
})
