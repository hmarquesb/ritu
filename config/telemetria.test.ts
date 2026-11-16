import { describe, expect, it } from "vitest"
import { METRICAS } from "../src/core/telemetry/nomes"
import { telemetria } from "./telemetria"

const histogramas = Object.entries(METRICAS)
  .filter(([, definicao]) => definicao.tipo === "histograma")
  .map(([nome]) => nome)

describe("config.telemetria", () => {
  it("todo histograma de METRICAS tem buckets em ordem crescente", () => {
    for (const nome of histogramas) {
      const buckets = telemetria.buckets[nome as keyof typeof telemetria.buckets]
      expect(buckets, `${nome} sem buckets`).toBeDefined()
      for (let i = 1; i < buckets.length; i++) {
        expect(buckets[i], `${nome} fora de ordem`).toBeGreaterThan(buckets[i - 1] as number)
      }
    }
  })

  it("nenhuma chave de buckets fica sem métrica histograma", () => {
    for (const nome of Object.keys(telemetria.buckets)) {
      expect(histogramas, `${nome} não é histograma`).toContain(nome)
    }
  })
})
