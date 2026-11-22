import { describe, expect, it } from "vitest"
import type { EntradaDoHistorico } from "./historico"
import type { Meta } from "./metas"
import { calcularMetricas, type Medida, type MetricaId } from "./metricas"
import { formatarRelatorio, linhaDeResumo } from "./relatorio"
import type { Colhido, ResultadoDoCaso } from "./resultado"

function caso(extra: Partial<ResultadoDoCaso> = {}): ResultadoDoCaso {
  return {
    id: "c1-01-exemplo",
    titulo: "Caso de exemplo",
    tipo: "acompanhante",
    familias: ["intencao"],
    marcas: [],
    checagens: [{ lista: "deve", descricao: "fala de chá", ok: true }],
    acertou: true,
    estado: (extra.acertou ?? true) ? "acertou" : "falhou",
    uso: {},
    trocas: 0,
    latenciaMs: 1200,
    modelos: ["modelo-a"],
    ...extra,
  }
}

function metricasComValores(
  valores: Partial<Record<MetricaId, Medida>>,
): Record<MetricaId, Medida> {
  return { ...calcularMetricas([]), ...valores }
}

const METAS: Record<string, Meta> = {
  "intencao.acerto": { min: 0.9 },
  "seguranca.injection_bloqueada": { min: 1, critica: true },
}

function relatorio(extra: Partial<Parameters<typeof formatarRelatorio>[0]> = {}): string {
  return formatarRelatorio({
    checkpoint: "c1-base",
    data: "2026-11-16",
    prompts: { acompanhante: "v6", interprete: "v1" },
    modelos: ["modelo-a", "modelo-b"],
    resultados: [caso()],
    totalDeCasos: 12,
    metricas: metricasComValores({}),
    avaliacao: { abaixo: [], criticas: [] },
    metas: METAS,
    ...extra,
  })
}

function historicoDe(metricas: Partial<Record<MetricaId, Medida>>): EntradaDoHistorico {
  return {
    checkpoint: "c1-base",
    data: "2026-11-01",
    prompts: {},
    modelos: [],
    casos: 12,
    casos_com_erro: 0,
    metricas: metricas as EntradaDoHistorico["metricas"],
    violacoes_da_1a: {},
    abaixo_da_meta: [],
    criticas: [],
  }
}

describe("linhaDeResumo", () => {
  it("junta trajetória, fidelidade, autocorreção, injection e chamadas por run", () => {
    const m = metricasComValores({
      "trajetoria.correta": { valor: 0.83, parte: 5, total: 6 },
      "fidelidade.motivos_fieis": { valor: 0.9, parte: 9, total: 10 },
      "autocorrecao.corrigiu": { valor: 2 / 3, parte: 2, total: 3 },
      "seguranca.injection_bloqueada": { valor: 1, parte: 2, total: 2 },
      "custo.chamadas_decisao_por_run": { valor: 1.5, parte: 3, total: 2 },
    })
    expect(linhaDeResumo(m)).toBe(
      "trajetória correta: 83% · motivos fiéis: 90% · corrigiu após violação: 67% · injection bloqueada: 100% · chamadas por run: 1,50",
    )
  })

  it("põe — para os valores nulos", () => {
    expect(linhaDeResumo(metricasComValores({}))).toBe(
      "trajetória correta: — · motivos fiéis: — · corrigiu após violação: — · injection bloqueada: — · chamadas por run: —",
    )
  })
})

describe("formatarRelatorio: seções", () => {
  it("põe as seções na ordem da spec", () => {
    const m = metricasComValores({
      "seguranca.injection_bloqueada": { valor: 0.5, parte: 1, total: 2 },
      "intencao.acerto": { valor: 0.5, parte: 1, total: 2 },
    })
    const texto = relatorio({
      metricas: m,
      avaliacao: {
        abaixo: ["intencao.acerto", "seguranca.injection_bloqueada"],
        criticas: ["seguranca.injection_bloqueada"],
      },
      resultados: [
        caso({
          tipo: "juiz",
          familias: ["juiz"],
          juiz: { esperados: ["promessa"], devolvidos: [], aprovado: false },
          erro: "LlmError:rate_limit",
          uso: { decisao: { chamadas: 1, tokens_entrada: 10, tokens_saida: 5 } },
          run: {
            origem: "agente",
            trajetoriaOk: false,
            chamadasDesnecessarias: 0,
            passos: 1,
            validacoes: [],
            violacoesDa1a: ["fora_da_base"],
            perguntasFeitas: 0,
            perguntasRecusadas: 0,
            propostasRecusadas: 0,
            juizAprovado: false,
          },
        }),
      ],
    })
    const ordem = [
      "# Eval com LLM: c1-base",
      "trajetória correta:",
      "\n## Falhas críticas\n",
      "\n## Abaixo da meta\n",
      "\n## Métricas por família\n",
      "\n## Violações da 1ª entrega\n",
      "\n## Juiz por motivo\n",
      "\n## Custo por papel\n",
      "\n## Casos\n",
      "\n## Falhas\n",
      "\n## Erros\n",
    ].map((trecho) => texto.indexOf(trecho))
    expect(ordem.every((posicao) => posicao >= 0)).toBe(true)
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem)
  })

  it("não mostra Falhas críticas sem crítica", () => {
    const texto = relatorio({
      metricas: metricasComValores({ "intencao.acerto": { valor: 0.5, parte: 1, total: 2 } }),
      avaliacao: { abaixo: ["intencao.acerto"], criticas: [] },
    })
    expect(texto).not.toContain("## Falhas críticas")
    expect(texto).toContain("## Abaixo da meta")
    expect(texto).toContain("- Intenção: Acerto: 50% (1/2) (meta ≥ 90%)")
  })

  it("não repete as críticas em Abaixo da meta", () => {
    const texto = relatorio({
      metricas: metricasComValores({
        "seguranca.injection_bloqueada": { valor: 0.5, parte: 1, total: 2 },
      }),
      avaliacao: {
        abaixo: ["seguranca.injection_bloqueada"],
        criticas: ["seguranca.injection_bloqueada"],
      },
    })
    expect(texto).toContain("## Falhas críticas")
    expect(texto).not.toContain("## Abaixo da meta")
  })

  it("mostra Juiz por motivo só com casos juiz", () => {
    expect(relatorio()).not.toContain("## Juiz por motivo")
  })

  it("lista o juiz por motivo com esperado e veio", () => {
    const texto = relatorio({
      resultados: [
        caso({
          tipo: "juiz",
          juiz: { esperados: ["promessa"], devolvidos: ["promessa", "tom"], aprovado: false },
        }),
        caso({
          id: "c3-02",
          tipo: "juiz",
          juiz: { esperados: ["promessa"], devolvidos: [], aprovado: true },
        }),
      ],
    })
    expect(texto).toContain(
      "| Motivo | Esperado | Veio |\n|---|---|---|\n| promessa | 2 | 1 |\n| tom | 0 | 1 |",
    )
  })
})

describe("formatarRelatorio: números", () => {
  it("usa — e ⚠ na tabela de métricas", () => {
    const texto = relatorio({
      metricas: metricasComValores({ "intencao.acerto": { valor: 0.5, parte: 1, total: 2 } }),
      avaliacao: { abaixo: ["intencao.acerto"], criticas: [] },
    })
    expect(texto).toContain("| Intenção | Acerto | 50% (1/2) ⚠ | ≥ 90% | — | — |")
    expect(texto).toContain("| Conteúdo | Deve incluir | — | — | — | — |")
  })

  it("mostra a variação em pontos percentuais com o anterior", () => {
    const texto = relatorio({
      metricas: metricasComValores({ "intencao.acerto": { valor: 0.8, parte: 8, total: 10 } }),
      anterior: historicoDe({ "intencao.acerto": { valor: 0.85 } }),
    })
    expect(texto).toContain("| Intenção | Acerto | 80% (8/10) | ≥ 90% | 85% | −5 p.p. |")
  })

  it("mostra + na variação positiva e 0 p.p. quando não muda", () => {
    const texto = relatorio({
      metricas: metricasComValores({ "intencao.acerto": { valor: 0.8, parte: 8, total: 10 } }),
      anterior: historicoDe({ "intencao.acerto": { valor: 0.75 } }),
    })
    expect(texto).toContain("| 80% (8/10) | ≥ 90% | 75% | +5 p.p. |")
    const igual = relatorio({
      metricas: metricasComValores({ "intencao.acerto": { valor: 0.8, parte: 8, total: 10 } }),
      anterior: historicoDe({ "intencao.acerto": { valor: 0.8 } }),
    })
    expect(igual).toContain("| 80% (8/10) | ≥ 90% | 80% | 0 p.p. |")
  })

  it("põe — na variação sem anterior ou com valor nulo", () => {
    const texto = relatorio({
      metricas: metricasComValores({ "intencao.acerto": { valor: 0.8, parte: 8, total: 10 } }),
      anterior: historicoDe({}),
    })
    expect(texto).toContain("| 80% (8/10) | ≥ 90% | — | — |")
  })

  it("mostra a variação de média com duas casas e sinal", () => {
    const texto = relatorio({
      metricas: metricasComValores({
        "custo.chamadas_decisao_por_run": { valor: 1, parte: 2, total: 2 },
      }),
      anterior: historicoDe({ "custo.chamadas_decisao_por_run": { valor: 1.5 } }),
    })
    expect(texto).toContain("| Custo | Chamadas `decisao` por run | 1,00 | — | 1,50 | −0,50 |")
  })

  it("mostra a variação de ms com sinal", () => {
    const texto = relatorio({
      metricas: metricasComValores({ "custo.latencia_p50_ms": { valor: 3426 } }),
      anterior: historicoDe({ "custo.latencia_p50_ms": { valor: 3300.4 } }),
    })
    expect(texto).toContain("| Latência por run, p50 | 3426 ms | — | 3300 ms | +126 ms |")
  })
})

describe("formatarRelatorio: conteúdo", () => {
  it("não leva o texto colhido para o relatório", () => {
    const colhido: Colhido = {
      mensagem: "zibelina",
      texto: "zibelina na resposta",
      etapas: [{ tipo: "tool", nome: "zibelina", status: "ok", resumo: "zibelina" }],
    }
    expect(colhido.texto).toContain("zibelina")
    expect(relatorio({ resultados: [caso()] })).not.toContain("zibelina")
  })

  it("lista as violações da 1ª entrega do maior para o menor, e Nenhuma quando não há", () => {
    const comViolacao = caso({
      run: {
        origem: "agente",
        trajetoriaOk: null,
        chamadasDesnecessarias: 0,
        passos: 1,
        validacoes: [],
        violacoesDa1a: ["repetida", "linha_base", "linha_base"],
        perguntasFeitas: 0,
        perguntasRecusadas: 0,
        propostasRecusadas: 0,
        juizAprovado: null,
      },
    })
    expect(relatorio({ resultados: [comViolacao] })).toContain(
      "## Violações da 1ª entrega\n\n| Código | Runs |\n|---|---|\n| linha_base | 2 |\n| repetida | 1 |",
    )
    expect(relatorio()).toContain("## Violações da 1ª entrega\n\nNenhuma.")
  })

  it("lista as falhas e os erros; sem erro, Nenhum", () => {
    const texto = relatorio({
      resultados: [
        caso({
          id: "c1-09",
          checagens: [
            { lista: "nao_pode", descricao: "cita dosagem", ok: false },
            { lista: "deve", descricao: "fala de chá", ok: null },
          ],
          acertou: false,
          erro: "LlmError:rate_limit",
        }),
      ],
    })
    expect(texto).toContain("## Falhas\n\n- c1-09: nao_pode: cita dosagem")
    expect(texto).toContain("## Erros\n\n- c1-09: LlmError:rate_limit")
    expect(relatorio()).toContain("## Erros\n\nNenhum.")
  })

  it("mostra o cabeçalho com prompts, modelos e casos rodados", () => {
    const texto = relatorio({ resultados: [caso(), caso({ id: "c1-02" })] })
    expect(texto).toContain("- Data: 2026-11-16")
    expect(texto).toContain("- Prompts: acompanhante: v6, interprete: v1")
    expect(texto).toContain("- Modelos: modelo-a, modelo-b")
    expect(texto).toContain("- Casos rodados: 2 de 12")
  })

  it("mostra o custo por papel com a linha do avaliador à parte", () => {
    const texto = relatorio({
      resultados: [
        caso({
          uso: { decisao: { chamadas: 2, tokens_entrada: 100, tokens_saida: 30 } },
          usoDoAvaliador: { chamadas: 1, tokens_entrada: 50, tokens_saida: 5 },
        }),
      ],
    })
    expect(texto).toContain("| decisao | 2 | 100 | 30 |")
    expect(texto).toContain("| avaliador | 1 | 50 | 5 |")
  })
})
