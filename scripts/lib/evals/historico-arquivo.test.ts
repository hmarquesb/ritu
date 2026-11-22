// Trava o arquivo do histórico (`evals/resultados/historico.json`) e a tabela gerada (`evals/COMPARACAO.md`) (spec 014, D20).
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { config } from "../../../config"
import { type Historico, historicoSchema } from "../../../src/core/evals/historico"
import { gerarComparacao } from "./comparacao"
import { formatarHistorico } from "./historico"
import { avaliarMetas } from "./metas"
import { DEFINICAO_DAS_METRICAS, type Medida, type MetricaId } from "./metricas"

const caminho = (relativo: string): string => fileURLToPath(new URL(relativo, import.meta.url))

const textoDoHistorico = readFileSync(caminho("../../../evals/resultados/historico.json"), "utf8")
const textoDaComparacao = readFileSync(caminho("../../../evals/COMPARACAO.md"), "utf8")

const historico: Historico = historicoSchema.parse(JSON.parse(textoDoHistorico))

describe("evals/resultados/historico.json", () => {
  it("valida com historicoSchema e tem as três entradas na ordem de checkpoints.ts", () => {
    expect(historico.versao).toBe(1)
    expect(historico.checkpoints.map((e) => e.checkpoint)).toEqual([
      "c1-base",
      "c2-conversa",
      "c3-confiavel",
    ])
  })

  it("tem toda métrica de DEFINICAO_DAS_METRICAS em cada entrada", () => {
    const ids = Object.keys(DEFINICAO_DAS_METRICAS).sort()
    for (const entrada of historico.checkpoints) {
      expect(Object.keys(entrada.metricas).sort()).toEqual(ids)
    }
  })

  it("abaixo_da_meta e criticas batem com avaliarMetas", () => {
    for (const entrada of historico.checkpoints) {
      const avaliado = avaliarMetas(
        entrada.metricas as Record<MetricaId, Medida>,
        config.evals.metas,
      )
      expect(entrada.abaixo_da_meta).toEqual(avaliado.abaixo)
      expect(entrada.criticas).toEqual(avaliado.criticas)
    }
  })

  it("está formatado por formatarHistorico", () => {
    expect(textoDoHistorico).toBe(formatarHistorico(historico))
  })
})

describe("evals/COMPARACAO.md", () => {
  it("é igual a gerarComparacao(historico)", () => {
    expect(textoDaComparacao).toBe(gerarComparacao(historico))
  })

  it("tem as colunas c1-base e c2-conversa e o rodapé", () => {
    expect(textoDaComparacao).toContain("| Métrica | c1-base | c2-conversa |")
    expect(textoDaComparacao).toContain("Em `c1-base` e `c2-conversa`")
  })
})
