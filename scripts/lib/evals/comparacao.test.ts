import { describe, expect, it } from "vitest"
import { TITULO_DA_FAMILIA } from "../../../evals/llm/tipos"
import type { Historico } from "../../../src/core/evals/historico"
import { gerarComparacao } from "./comparacao"
import type { EntradaDoHistorico } from "./historico"
import { DEFINICAO_DAS_METRICAS, type MetricaId } from "./metricas"

const RODAPE =
  "Em `c1-base` e `c2-conversa`, Explicação incluía 'o texto bate com as sugestões', que desde o `c3-confiavel` conta em Fidelidade."

function entrada(extra: Partial<EntradaDoHistorico> = {}): EntradaDoHistorico {
  return {
    checkpoint: "c1-base",
    data: "2026-11-16",
    prompts: { acompanhante: "v6", interprete: "v1" },
    modelos: ["modelo-a", "modelo-b"],
    casos: 12,
    casos_com_erro: 0,
    metricas: {},
    violacoes_da_1a: {},
    abaixo_da_meta: [],
    criticas: [],
    ...extra,
  }
}

function historico(...entradas: EntradaDoHistorico[]): Historico {
  return { versao: 1, checkpoints: entradas }
}

function linhaDe(texto: string, rotulo: string): string {
  const linha = texto.split("\n").find((l) => l.startsWith(`| ${rotulo} |`))
  if (linha === undefined) throw new Error(`sem linha ${rotulo}`)
  return linha
}

describe("gerarComparacao", () => {
  it("começa com o título e a linha de texto", () => {
    const texto = gerarComparacao(historico(entrada()))
    expect(texto.startsWith("# Evolução dos evals com LLM\n")).toBe(true)
    expect(texto).toContain(
      "Uma coluna por checkpoint e uma linha por métrica, gerada de `evals/resultados/historico.json`. O detalhe de cada rodada está em `evals/resultados/<checkpoint>.md`.",
    )
  })

  it("mostra Data, Prompts, Modelos e Casos antes das métricas", () => {
    const texto = gerarComparacao(historico(entrada()))
    expect(linhaDe(texto, "Data")).toBe("| Data | 2026-11-16 |")
    expect(linhaDe(texto, "Prompts")).toBe("| Prompts | v6, v1 |")
    expect(linhaDe(texto, "Modelos")).toBe("| Modelos | modelo-a, modelo-b |")
    expect(linhaDe(texto, "Casos")).toBe("| Casos | 12 |")
  })

  it("põe uma coluna por checkpoint, na ordem do histórico", () => {
    const texto = gerarComparacao(
      historico(entrada({ checkpoint: "c3-confiavel" }), entrada({ checkpoint: "c1-base" })),
    )
    const cabecalho = texto.split("\n").find((l) => l.startsWith("| Métrica"))
    expect(cabecalho).toBe("| Métrica | c3-confiavel | c1-base |")
  })

  it("usa — para null e para métrica ausente na entrada", () => {
    const texto = gerarComparacao(
      historico(
        entrada({
          metricas: { "intencao.acerto": { valor: null } },
        }),
      ),
    )
    expect(linhaDe(texto, "**Intenção**: Acerto")).toBe("| **Intenção**: Acerto | — |")
    expect(linhaDe(texto, "**Conteúdo**: Deve incluir")).toBe("| **Conteúdo**: Deve incluir | — |")
  })

  it("formata taxa com parte e total, média com duas casas e vírgula, e ms inteiro", () => {
    const texto = gerarComparacao(
      historico(
        entrada({
          metricas: {
            "intencao.acerto": { valor: 0.83, parte: 10, total: 12 },
            "custo.tokens_entrada_por_run": { valor: 0.06 },
            "custo.latencia_p50_ms": { valor: 3426.4 },
          },
        }),
      ),
    )
    expect(linhaDe(texto, "**Intenção**: Acerto")).toBe("| **Intenção**: Acerto | 83% (10/12) |")
    expect(linhaDe(texto, "**Custo**: Tokens de entrada por run")).toBe(
      "| **Custo**: Tokens de entrada por run | 0,06 |",
    )
    expect(linhaDe(texto, "**Custo**: Latência por run, p50")).toBe(
      "| **Custo**: Latência por run, p50 | 3426 ms |",
    )
  })

  it("põe ⚠ depois do valor que está abaixo da meta", () => {
    const texto = gerarComparacao(
      historico(
        entrada({
          metricas: { "intencao.acerto": { valor: 0.5, parte: 1, total: 2 } },
          abaixo_da_meta: ["intencao.acerto"],
        }),
      ),
    )
    expect(linhaDe(texto, "**Intenção**: Acerto")).toBe("| **Intenção**: Acerto | 50% (1/2) ⚠ |")
  })

  it("termina com o rodapé fixo e uma quebra de linha", () => {
    const texto = gerarComparacao(historico(entrada()))
    expect(texto.endsWith(`${RODAPE}\n`)).toBe(true)
  })

  it("rodar duas vezes dá o mesmo texto", () => {
    const h = historico(entrada(), entrada({ checkpoint: "c3-confiavel" }))
    expect(gerarComparacao(h)).toBe(gerarComparacao(h))
  })

  it("agrupa as métricas por família na ordem de DEFINICAO_DAS_METRICAS", () => {
    const texto = gerarComparacao(historico(entrada()))
    const familias: string[] = []
    for (const linha of texto.split("\n")) {
      const achado = /^\| \*\*([^*]+)\*\*: /.exec(linha)
      if (achado?.[1] !== undefined && familias.at(-1) !== achado[1]) familias.push(achado[1])
    }
    const esperadas: string[] = []
    for (const id of Object.keys(DEFINICAO_DAS_METRICAS) as MetricaId[]) {
      const titulo = TITULO_DA_FAMILIA[DEFINICAO_DAS_METRICAS[id].familia]
      if (esperadas.at(-1) !== titulo) esperadas.push(titulo)
    }
    expect(familias).toEqual(esperadas)
  })
})
