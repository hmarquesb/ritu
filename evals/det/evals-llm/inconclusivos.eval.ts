import { describe, expect, it } from "vitest"
import { classificarCaso, fecharEstado } from "../../../scripts/lib/evals/inconclusivo"
import { calcularMetricas } from "../../../scripts/lib/evals/metricas"
import type { ResultadoDoCaso } from "../../../scripts/lib/evals/resultado"

// Um caso sem resposta conclusiva (infraestrutura falhou) não vira acerto nem falha: fica fora das métricas.
// Sem rede, sem banco, sem chave: a classificação é pura.

const base = { etapas: [], houveCotaOu429: false, validouOk: false, chamadasDeDecisao: 0 }

describe("um caso por motivo de inconclusivo", () => {
  it.each([
    ["cota", { ...base, houveCotaOu429: true }],
    ["cota", { ...base, fim: "indisponivel" as const }],
    ["juiz_indisponivel", { ...base, validouOk: true, juiz: "indisponivel" as const }],
    ["banco", { ...base, erro: "AggregateError: connect ECONNREFUSED" }],
    ["timeout_sem_decisao", { ...base, erro: "timeout após 30 s" }],
    ["sem_etapas", { ...base, erro: "resposta vazia" }],
  ])("%s", (motivo, entrada) => {
    expect(classificarCaso(entrada)).toEqual({ estado: "inconclusivo", inconclusivo: motivo })
  })

  it("sem erro de infraestrutura, o caso é falhou e não ganha motivo", () => {
    expect(classificarCaso(base)).toEqual({ estado: "falhou" })
  })

  it("inconclusivo nunca vira acertou, mesmo com as checagens certas", () => {
    const inc = classificarCaso({ ...base, houveCotaOu429: true })
    expect(fecharEstado(true, inc)).toEqual({ estado: "inconclusivo", inconclusivo: "cota" })
    expect(fecharEstado(true, classificarCaso(base))).toEqual({ estado: "acertou" })
    expect(fecharEstado(false, classificarCaso(base))).toEqual({ estado: "falhou" })
  })
})

function caso(extra: Partial<ResultadoDoCaso> = {}): ResultadoDoCaso {
  return {
    id: "c",
    titulo: "caso",
    tipo: "conversa",
    familias: ["intencao"],
    marcas: [],
    checagens: [],
    acertou: true,
    estado: "acertou",
    ...extra,
  } as ResultadoDoCaso
}

describe("inconclusivos fora das métricas", () => {
  it("as métricas com inconclusivos são as mesmas de sem eles", () => {
    const conclusivos = [caso(), caso({ acertou: false, estado: "falhou" })]
    const inconclusivo = caso({ acertou: false, estado: "inconclusivo", inconclusivo: "cota" })

    expect(calcularMetricas([...conclusivos, inconclusivo, inconclusivo])).toEqual(
      calcularMetricas(conclusivos),
    )
  })

  it("só inconclusivos deixam a métrica sem valor", () => {
    const inconclusivo = caso({ acertou: false, estado: "inconclusivo", inconclusivo: "banco" })
    expect(calcularMetricas([inconclusivo])["intencao.acerto"].valor).toBeNull()
  })
})
