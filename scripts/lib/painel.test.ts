import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { METRICAS, type NomeDeMetrica } from "@/core/telemetry/nomes"
import { ALERTAS, PAINEL } from "./painel"
import { gerarAlertas, gerarPainel } from "./painel-grafana"

const RAIZ = new URL("../../", import.meta.url)
const lerDaRaiz = (caminho: string) => readFileSync(new URL(caminho, RAIZ), "utf8")

const SUFIXOS_DE_HISTOGRAMA = ["_bucket", "_count", "_sum"]

const consultasDoPainel = PAINEL.linhas.flatMap((linha) =>
  linha.paineis.flatMap((painel) => painel.consultas.map((consulta) => consulta.expr)),
)

const expressoesDeAlerta = ALERTAS.map((alerta) => alerta.expr)

/** Nomes `ritu_*` citados numa expressão, com o sufixo de histograma se houver. */
function seriesCitadas(expr: string): string[] {
  return expr.match(/ritu_[a-z0-9_]+/g) ?? []
}

/** Nome-base da métrica de uma série: tira `_bucket`, `_count` ou `_sum` só de histograma. */
function baseDaSerie(serie: string): string | undefined {
  if (serie in METRICAS) return serie
  for (const sufixo of SUFIXOS_DE_HISTOGRAMA) {
    if (!serie.endsWith(sufixo)) continue
    const base = serie.slice(0, -sufixo.length)
    if (base in METRICAS && METRICAS[base as NomeDeMetrica].tipo === "histograma") return base
  }
  return undefined
}

describe("painel do Grafana gerado", () => {
  it("o JSON commitado é o que gerarPainel produz hoje", () => {
    const esperado = `${JSON.stringify(gerarPainel(PAINEL), null, 2)}\n`
    expect(lerDaRaiz("observability/dashboards/ritu.json")).toBe(esperado)
  })

  it("o YAML de alertas commitado é o que gerarAlertas produz hoje", () => {
    expect(lerDaRaiz("observability/grafana/alerting/ritu.yaml")).toBe(gerarAlertas(ALERTAS))
  })

  it("toda métrica de METRICAS aparece em alguma consulta do painel", () => {
    const citadas = new Set(
      consultasDoPainel.flatMap(seriesCitadas).map((serie) => baseDaSerie(serie)),
    )
    const ausentes = Object.keys(METRICAS).filter((nome) => !citadas.has(nome))
    expect(ausentes).toEqual([])
  })

  it("toda consulta do painel só cita métricas de METRICAS, com sufixo só em histograma", () => {
    const desconhecidas = consultasDoPainel
      .flatMap(seriesCitadas)
      .filter((serie) => baseDaSerie(serie) === undefined)
    expect(desconhecidas).toEqual([])
  })

  it("a linha do agente tem os painéis de edição da memória e de contas apagadas", () => {
    const linhaDoAgente = PAINEL.linhas.find((linha) => linha.titulo === "2. Agente")
    const titulos = linhaDoAgente?.paineis.map((painel) => painel.titulo) ?? []
    expect(titulos).toContain("Edições da memória pela pessoa")
    expect(titulos).toContain("Contas apagadas")
    const expressoes = consultasDoPainel.join("\n")
    expect(expressoes).toContain("ritu_memoria_edicoes_total")
    expect(expressoes).toContain("ritu_conta_apagada_total")
  })

  it("toda expressão de alerta só cita métricas de METRICAS", () => {
    const desconhecidas = expressoesDeAlerta
      .flatMap(seriesCitadas)
      .filter((serie) => baseDaSerie(serie) === undefined)
    expect(desconhecidas).toEqual([])
  })
})
