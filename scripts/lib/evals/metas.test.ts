import { describe, expect, it } from "vitest"
import { avaliarMetas, textoDaMeta } from "./metas"
import { DEFINICAO_DAS_METRICAS, type Medida, type MetricaId } from "./metricas"

const SEM_VALOR: Medida = { valor: null, parte: 0, total: 0 }

function metricasCom(
  parciais: Partial<Record<MetricaId, number | null>>,
): Record<MetricaId, Medida> {
  const todas = {} as Record<MetricaId, Medida>
  for (const id of Object.keys(DEFINICAO_DAS_METRICAS) as MetricaId[]) {
    const valor = parciais[id]
    todas[id] = valor === undefined ? SEM_VALOR : { valor }
  }
  return todas
}

describe("avaliarMetas", () => {
  it("min: valor igual ao mínimo não está abaixo; abaixo do mínimo está", () => {
    const metricas = metricasCom({ "intencao.acerto": 0.9, "casa.acerto": 0.89 })
    const metas = { "intencao.acerto": { min: 0.9 }, "casa.acerto": { min: 0.9 } }
    expect(avaliarMetas(metricas, metas)).toEqual({ abaixo: ["casa.acerto"], criticas: [] })
  })

  it("max: valor acima do máximo está fora da meta; igual não está", () => {
    const metricas = metricasCom({
      "trajetoria.desnecessarias_por_run": 0.5,
      "custo.chamadas_apoio_por_run": 0.6,
    })
    const metas = {
      "trajetoria.desnecessarias_por_run": { max: 0.5 },
      "custo.chamadas_apoio_por_run": { max: 0.5 },
    }
    expect(avaliarMetas(metricas, metas).abaixo).toEqual(["custo.chamadas_apoio_por_run"])
  })

  it("crítica entra em criticas e em abaixo", () => {
    const metricas = metricasCom({
      "seguranca.injection_bloqueada": 0.5,
      "seguranca.bloqueio": 0.5,
    })
    const metas = {
      "seguranca.injection_bloqueada": { min: 1, critica: true as const },
      "seguranca.bloqueio": { min: 1 },
    }
    expect(avaliarMetas(metricas, metas)).toEqual({
      abaixo: ["seguranca.bloqueio", "seguranca.injection_bloqueada"],
      criticas: ["seguranca.injection_bloqueada"],
    })
  })

  it("valor null nunca está abaixo", () => {
    const metricas = metricasCom({ "casa.acerto": null })
    expect(avaliarMetas(metricas, { "casa.acerto": { min: 0.9, critica: true } })).toEqual({
      abaixo: [],
      criticas: [],
    })
  })

  it("métrica sem meta nunca está abaixo", () => {
    const metricas = metricasCom({ "casa.acerto": 0 })
    expect(avaliarMetas(metricas, {})).toEqual({ abaixo: [], criticas: [] })
  })

  it("abaixo sai na ordem da definição das métricas", () => {
    const metricas = metricasCom({ "custo.trocas": 5, "casa.acerto": 0, "intencao.acerto": 0 })
    const metas = {
      "custo.trocas": { max: 1 },
      "casa.acerto": { min: 1 },
      "intencao.acerto": { min: 1 },
    }
    expect(avaliarMetas(metricas, metas).abaixo).toEqual([
      "intencao.acerto",
      "casa.acerto",
      "custo.trocas",
    ])
  })
})

describe("textoDaMeta", () => {
  it("sem meta dá —", () => {
    expect(textoDaMeta(undefined, "taxa")).toBe("—")
    expect(textoDaMeta({ critica: true }, "taxa")).toBe("—")
  })

  it("taxa com mínimo dá porcentagem inteira", () => {
    expect(textoDaMeta({ min: 0.9 }, "taxa")).toBe("≥ 90%")
  })

  it("taxa com mínimo 1 dá 100%", () => {
    expect(textoDaMeta({ min: 1 }, "taxa")).toBe("100%")
  })

  it("máximo 0 dá 0", () => {
    expect(textoDaMeta({ max: 0 }, "contagem")).toBe("0")
    expect(textoDaMeta({ max: 0 }, "taxa")).toBe("0")
  })

  it("média com máximo usa vírgula e duas casas no máximo", () => {
    expect(textoDaMeta({ max: 0.5 }, "media")).toBe("≤ 0,5")
    expect(textoDaMeta({ max: 0.06 }, "media")).toBe("≤ 0,06")
  })

  it("ms dá inteiro com a unidade", () => {
    expect(textoDaMeta({ max: 20000 }, "ms")).toBe("≤ 20000 ms")
  })

  it("contagem com mínimo", () => {
    expect(textoDaMeta({ min: 2 }, "contagem")).toBe("≥ 2")
  })
})
