import { describe, expect, it } from "vitest"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { ATRIBUTOS_PERMITIDOS, METRICAS, SPANS } from "./nomes"

describe("nomes da telemetria", () => {
  it("METRICAS contém o guardrail e os avisos do Juiz", () => {
    expect(METRICAS).toContain("ritu_guardrail_total")
    expect(METRICAS).toContain("ritu_juiz_avisos_total")
  })

  it("createMemoryTelemetry aceita o guardrail com resultado e origem, e os avisos com motivo", () => {
    const t = createMemoryTelemetry()

    expect(() =>
      t.contador("ritu_guardrail_total", { resultado: "alerta_fisico", origem: "codigo" }),
    ).not.toThrow()
    expect(() => t.contador("ritu_juiz_avisos_total", { motivo: "tom" })).not.toThrow()
    expect(t.metricas.map((m) => m.nome)).toEqual([
      "ritu_guardrail_total",
      "ritu_juiz_avisos_total",
    ])
  })

  it("SPANS contém os nomes da árvore do run", () => {
    expect(SPANS).toContain("agente.passo")
    expect(SPANS).toContain("aprovacao.execucao")
    expect(SPANS).toContain("toque")
    expect(SPANS).toHaveLength(13)
  })

  it("SPANS contém a memória e a detecção de padrões", () => {
    expect(SPANS).toContain("memoria.resumo")
    expect(SPANS).toContain("padroes.deteccao")
  })

  it("METRICAS contém o resumo de rotina e os padrões", () => {
    expect(METRICAS).toContain("ritu_rotina_resumo_total")
    expect(METRICAS).toContain("ritu_padroes_total")
  })

  it("ATRIBUTOS_PERMITIDOS contém os atributos da memória e dos padrões", () => {
    expect(ATRIBUTOS_PERMITIDOS).toContain("resumo.origem")
    expect(ATRIBUTOS_PERMITIDOS).toContain("padroes.contas")
    expect(ATRIBUTOS_PERMITIDOS).toContain("padroes.propostos")
  })

  it("toda métrica começa com ritu_", () => {
    for (const nome of METRICAS) {
      expect(nome.startsWith("ritu_")).toBe(true)
    }
  })

  it("ATRIBUTOS_PERMITIDOS inclui os extras e os rótulos da tabela", () => {
    expect(ATRIBUTOS_PERMITIDOS).toContain("run.id")
    expect(ATRIBUTOS_PERMITIDOS).toContain("erro.codigo")
    expect(ATRIBUTOS_PERMITIDOS).toContain("trace_id")
    expect(ATRIBUTOS_PERMITIDOS).toContain("pausa.tipo")
    expect(ATRIBUTOS_PERMITIDOS).toContain("modelo")
  })

  it("METRICAS e ATRIBUTOS_PERMITIDOS têm a entrada", () => {
    expect(METRICAS).toContain("ritu_entrada_total")
    expect(ATRIBUTOS_PERMITIDOS).toContain("entrada.resultado")
  })
})
