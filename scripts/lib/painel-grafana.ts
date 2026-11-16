import { telemetria } from "@config/telemetria"
import type { Alerta, Fonte, PAINEL, Painel } from "./painel"

const COLUNAS = 24
const ALTURA = 8
const LARGURA_PADRAO = 12
const LARGURA_STAT = 6
const LIMITE_DE_TABELA = 20
const SCHEMA_VERSION = 39

type Posicao = { x: number; y: number; w: number; h: number }

const FONTES: Record<Fonte, { tipo: string; variavel: string }> = {
  metricas: { tipo: "prometheus", variavel: "ds_metricas" },
  logs: { tipo: "loki", variavel: "ds_logs" },
  traces: { tipo: "tempo", variavel: "ds_traces" },
}

function fonteDeDados(fonte: Fonte) {
  const { tipo, variavel } = FONTES[fonte]
  return { type: tipo, uid: `\${${variavel}}` }
}

function variavelDeFonte(nome: string, rotulo: string, query: string) {
  return {
    name: nome,
    label: rotulo,
    type: "datasource",
    query,
    current: {},
    hide: 0,
    includeAll: false,
    multi: false,
    options: [],
    refresh: 1,
    regex: "",
    skipUrlSync: false,
  }
}

function variaveis() {
  return {
    list: [
      variavelDeFonte("ds_metricas", "Métricas", "prometheus"),
      variavelDeFonte("ds_logs", "Logs", "loki"),
      variavelDeFonte("ds_traces", "Rastro", "tempo"),
    ],
  }
}

function limitesDeCor(limites: Painel["limites"]) {
  const steps: { color: string; value: number | null }[] = [{ color: "green", value: null }]
  if (limites) {
    steps.push({ color: "yellow", value: limites.amarelo })
    steps.push({ color: "red", value: limites.vermelho })
  }
  return { mode: "absolute", steps }
}

function letra(indice: number): string {
  return String.fromCharCode(65 + indice)
}

function alvosDoPainel(painel: Painel, datasource: ReturnType<typeof fonteDeDados>) {
  return painel.consultas.map((consulta, i) => {
    const refId = letra(i)
    if (painel.fonte === "traces") {
      return {
        refId,
        datasource,
        queryType: "traceql",
        tableType: "spans",
        query: consulta.expr,
        limit: LIMITE_DE_TABELA,
      }
    }
    if (painel.fonte === "logs") {
      return { refId, datasource, expr: consulta.expr, queryType: "range" }
    }
    return {
      refId,
      datasource,
      expr: consulta.expr,
      legendFormat: consulta.legenda ?? "__auto",
      range: true,
    }
  })
}

function colunasDoRastro() {
  return [
    {
      id: "organize",
      options: {
        indexByName: { "run.caminho": 0, "run.status": 1, "run.passos": 2, duration: 3 },
        excludeByName: {},
        renameByName: {},
      },
    },
  ]
}

function painelGrafana(painel: Painel, id: number, gridPos: Posicao): object {
  const datasource = fonteDeDados(painel.fonte)
  const base = {
    id,
    type: painel.tipo,
    title: painel.titulo,
    description: painel.descricao,
    datasource,
    gridPos,
    fieldConfig: {
      defaults: {
        ...(painel.unidade ? { unit: painel.unidade } : {}),
        thresholds: limitesDeCor(painel.limites),
      },
      overrides: [],
    },
    options: {},
    targets: alvosDoPainel(painel, datasource),
  }
  if (painel.fonte === "traces") return { ...base, transformations: colunasDoRastro() }
  return base
}

function linhaGrafana(titulo: string, id: number, y: number): object {
  return {
    id,
    type: "row",
    title: titulo,
    collapsed: false,
    panels: [],
    gridPos: { x: 0, y, w: COLUNAS, h: 1 },
  }
}

function larguraDo(painel: Painel): number {
  return painel.tipo === "stat" ? LARGURA_STAT : LARGURA_PADRAO
}

/** Põe os painéis em grade a partir de `y0`, quebrando a linha quando não cabem. */
function posicionar(paineis: Painel[], y0: number) {
  const itens: { painel: Painel; gridPos: Posicao }[] = []
  let x = 0
  let y = y0
  for (const painel of paineis) {
    const w = larguraDo(painel)
    if (x + w > COLUNAS) {
      x = 0
      y += ALTURA
    }
    itens.push({ painel, gridPos: { x, y, w, h: ALTURA } })
    x += w
  }
  return { itens, fim: x > 0 ? y + ALTURA : y }
}

export function gerarPainel(p: typeof PAINEL): object {
  const panels: object[] = []
  let id = 0
  let y = 0
  for (const linha of p.linhas) {
    panels.push(linhaGrafana(linha.titulo, ++id, y))
    const { itens, fim } = posicionar(linha.paineis, y + 1)
    for (const { painel, gridPos } of itens) {
      panels.push(painelGrafana(painel, ++id, gridPos))
    }
    y = fim
  }
  return {
    uid: p.uid,
    title: p.titulo,
    schemaVersion: SCHEMA_VERSION,
    tags: ["ritu"],
    timezone: "browser",
    time: { from: "now-24h", to: "now" },
    templating: variaveis(),
    panels,
  }
}

function regraDeAlerta(a: Alerta) {
  const modeloDaConsulta = {
    refId: "A",
    expr: a.expr,
    instant: true,
    range: false,
    intervalMs: 1000,
    maxDataPoints: 43200,
  }
  return {
    uid: a.uid,
    title: a.titulo,
    condition: "C",
    data: [
      {
        refId: "A",
        relativeTimeRange: { from: 600, to: 0 },
        datasourceUid: telemetria.grafana.uidMetricas,
        model: modeloDaConsulta,
      },
      {
        refId: "C",
        relativeTimeRange: { from: 0, to: 0 },
        datasourceUid: "__expr__",
        model: {
          refId: "C",
          type: "threshold",
          datasource: { type: "__expr__", uid: "__expr__" },
          expression: "A",
          conditions: [
            {
              evaluator: { params: [0], type: "gt" },
              operator: { type: "and" },
              query: { params: ["A"] },
              reducer: { params: [], type: "last" },
              type: "query",
            },
          ],
          intervalMs: 1000,
          maxDataPoints: 43200,
        },
      },
    ],
    noDataState: "OK",
    execErrState: "Error",
    for: a.para,
    labels: { gravidade: "aviso" },
    annotations: { summary: a.resumo },
  }
}

export function gerarAlertas(a: Alerta[]): string {
  const doc = {
    apiVersion: 1,
    groups: [
      {
        orgId: 1,
        name: "ritu",
        folder: telemetria.grafana.pasta,
        interval: "1m",
        rules: a.map(regraDeAlerta),
      },
    ],
  }
  return `${JSON.stringify(doc, null, 2)}\n`
}
