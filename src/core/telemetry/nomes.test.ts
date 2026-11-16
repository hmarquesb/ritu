import { describe, expect, expectTypeOf, it } from "vitest"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import {
  ATRIBUTOS_PERMITIDOS,
  type CodigoDeLog,
  LOGS,
  METRICAS,
  type NomeDeContador,
  type NomeDeHistograma,
  type NomeDeMedidor,
  type NomeDeMetrica,
  type NomeDeSpan,
  SPANS,
} from "./nomes"

const atributosPermitidos: readonly string[] = ATRIBUTOS_PERMITIDOS

describe("nomes da telemetria", () => {
  it("METRICAS contém o guardrail e os avisos do Juiz", () => {
    expect(Object.keys(METRICAS)).toContain("ritu_guardrail_total")
    expect(Object.keys(METRICAS)).toContain("ritu_juiz_avisos_total")
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
    expect(Object.keys(SPANS)).toContain("agente.passo")
    expect(Object.keys(SPANS)).toContain("aprovacao.execucao")
    expect(Object.keys(SPANS)).toContain("toque")
    expect(Object.keys(SPANS)).toHaveLength(13)
  })

  it("SPANS contém a memória e a detecção de padrões", () => {
    expect(Object.keys(SPANS)).toContain("memoria.resumo")
    expect(Object.keys(SPANS)).toContain("padroes.deteccao")
  })

  it("todo atributo de SPANS está em ATRIBUTOS_PERMITIDOS", () => {
    for (const atributos of Object.values(SPANS)) {
      for (const atributo of atributos) {
        expect(atributosPermitidos).toContain(atributo)
      }
    }
  })

  it("tem 27 métricas, todas com tipo e rótulos", () => {
    expect(Object.keys(METRICAS)).toHaveLength(27)
    for (const definicao of Object.values(METRICAS)) {
      expect(["contador", "histograma", "medidor"]).toContain(definicao.tipo)
      expect(Array.isArray(definicao.rotulos)).toBe(true)
    }
  })

  it("todo rótulo de METRICAS está em ATRIBUTOS_PERMITIDOS e nenhum é identificador da pessoa", () => {
    for (const definicao of Object.values(METRICAS)) {
      for (const rotulo of definicao.rotulos) {
        expect(atributosPermitidos).toContain(rotulo)
        expect(["run.id", "trace_id", "conta_id"]).not.toContain(rotulo)
      }
    }
  })

  it("registra os tipos de cada métrica com os rótulos da spec", () => {
    expect(METRICAS.ritu_llm_duracao_ms).toEqual({
      tipo: "histograma",
      rotulos: ["modelo", "papel"],
    })
    expect(METRICAS.ritu_tool_duracao_ms).toEqual({ tipo: "histograma", rotulos: ["tool"] })
    expect(METRICAS.ritu_juiz_total).toEqual({ tipo: "contador", rotulos: ["resultado"] })
    expect(METRICAS.ritu_llm_cota_usada).toEqual({ tipo: "medidor", rotulos: ["modelo", "janela"] })
    expect(METRICAS.ritu_fallback_sem_llm_total).toEqual({ tipo: "contador", rotulos: [] })
  })

  it("separa os nomes de métrica por tipo", () => {
    expectTypeOf<"ritu_run_passos">().not.toMatchTypeOf<NomeDeContador>()
    expectTypeOf<"ritu_run_passos">().toMatchTypeOf<NomeDeHistograma>()
    expectTypeOf<"ritu_llm_cota_usada">().toMatchTypeOf<NomeDeMedidor>()
    expectTypeOf<"ritu_tokens_total">().toMatchTypeOf<NomeDeContador>()
    expectTypeOf<NomeDeMetrica>().toEqualTypeOf<keyof typeof METRICAS>()
    expectTypeOf<NomeDeSpan>().toEqualTypeOf<keyof typeof SPANS>()
  })

  it("LOGS tem os 12 códigos com os níveis da spec", () => {
    expect(LOGS).toEqual({
      run_inicio: "info",
      run_retomado: "info",
      run_fim: "info",
      clima_indisponivel: "warn",
      troca_de_modelo: "warn",
      sem_modelo: "warn",
      llm_erro: "warn",
      resposta_segura: "warn",
      atributo_proibido: "warn",
      run_falhou: "error",
      padroes_conta_falhou: "error",
      erro_inesperado: "error",
    })
    expect(Object.keys(LOGS)).toHaveLength(12)
    expectTypeOf<CodigoDeLog>().toEqualTypeOf<keyof typeof LOGS>()
  })

  it("toda métrica começa com ritu_", () => {
    for (const nome of Object.keys(METRICAS)) {
      expect(nome.startsWith("ritu_")).toBe(true)
    }
  })

  it("ATRIBUTOS_PERMITIDOS contém os atributos da memória e dos padrões", () => {
    expect(ATRIBUTOS_PERMITIDOS).toContain("resumo.origem")
    expect(ATRIBUTOS_PERMITIDOS).toContain("padroes.contas")
    expect(ATRIBUTOS_PERMITIDOS).toContain("padroes.propostos")
  })

  it("ATRIBUTOS_PERMITIDOS inclui os extras e os rótulos da tabela", () => {
    expect(ATRIBUTOS_PERMITIDOS).toContain("run.id")
    expect(ATRIBUTOS_PERMITIDOS).toContain("erro.codigo")
    expect(ATRIBUTOS_PERMITIDOS).toContain("trace_id")
    expect(ATRIBUTOS_PERMITIDOS).toContain("pausa.tipo")
    expect(ATRIBUTOS_PERMITIDOS).toContain("modelo")
  })
})
