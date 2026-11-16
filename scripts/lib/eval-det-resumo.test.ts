import { describe, expect, it } from "vitest"
import { resumirEvalDet } from "./eval-det-resumo"

const RAIZ_DO_PROJETO = "/home/runner/work/ritu/ritu"

function arquivo(caminho: string, status: string, casos: string[]) {
  return {
    name: `${RAIZ_DO_PROJETO}/${caminho}`,
    status,
    message: "",
    startTime: 0,
    endTime: 0,
    assertionResults: casos.map((situacao, i) => ({
      ancestorTitles: ["grupo"],
      fullName: `grupo caso ${i}`,
      status: situacao,
      title: `caso ${i}`,
      duration: 1,
      failureMessages: situacao === "failed" ? ["falhou"] : [],
      meta: {},
      tags: [],
      benchmarks: [],
    })),
  }
}

const RELATORIO = {
  numTotalTestSuites: 4,
  numPassedTestSuites: 3,
  numFailedTestSuites: 1,
  numTotalTests: 8,
  numPassedTests: 7,
  numFailedTests: 1,
  success: false,
  startTime: 0,
  testResults: [
    arquivo("evals/det/memoria/a.eval.ts", "passed", ["passed", "passed"]),
    arquivo("evals/det/memoria/b.eval.ts", "failed", ["passed", "failed"]),
    arquivo("evals/det/acompanhante/c.eval.ts", "passed", ["passed", "passed", "passed"]),
    arquivo("evals/det/mapa.eval.ts", "passed", ["passed"]),
  ],
}

describe("resumirEvalDet", () => {
  it("monta o título, a tabela por pasta em ordem e a linha de total", () => {
    const texto = resumirEvalDet(RELATORIO)

    expect(texto).toBe(
      [
        "## Evals determinísticos",
        "",
        "| Grupo | Arquivos | Casos | Falhas |",
        "| --- | ---: | ---: | ---: |",
        "| (raiz) | 1 | 1 | 0 |",
        "| acompanhante | 1 | 3 | 0 |",
        "| memoria | 2 | 4 | 1 |",
        "| **Total** | 4 | 8 | 1 |",
      ].join("\n"),
    )
  })

  it("conta um arquivo que quebrou antes de rodar os casos como uma falha", () => {
    const texto = resumirEvalDet({
      testResults: [
        arquivo("evals/det/base/quebrado.eval.ts", "failed", []),
        arquivo("evals/det/base/ok.eval.ts", "passed", ["passed"]),
      ],
    })

    expect(texto).toContain("| base | 2 | 1 | 1 |")
    expect(texto).toContain("| **Total** | 2 | 1 | 1 |")
  })

  it("aceita um relatório vazio, só com o total zerado", () => {
    const texto = resumirEvalDet({ testResults: [] })

    expect(texto).toContain("| **Total** | 0 | 0 | 0 |")
    expect(texto.split("\n")).toHaveLength(5)
  })

  it("lança quando o JSON não está no formato do reporter do Vitest", () => {
    expect(() => resumirEvalDet("não é um relatório")).toThrow()
    expect(() => resumirEvalDet(null)).toThrow()
    expect(() => resumirEvalDet({})).toThrow()
    expect(() => resumirEvalDet({ testResults: [{ name: 1 }] })).toThrow()
  })

  it("lança quando um arquivo do relatório não fica em evals/det/", () => {
    expect(() =>
      resumirEvalDet({ testResults: [arquivo("src/outro.test.ts", "passed", ["passed"])] }),
    ).toThrow()
  })
})
