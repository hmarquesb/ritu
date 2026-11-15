import { describe, expect, it } from "vitest"
import { ATRIBUTOS_PERMITIDOS, METRICAS, SPANS } from "./nomes"

describe("nomes da telemetria", () => {
  it("SPANS contém os nomes da árvore do run", () => {
    expect(SPANS).toContain("agente.passo")
    expect(SPANS).toContain("aprovacao.execucao")
    expect(SPANS).toHaveLength(10)
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
})
