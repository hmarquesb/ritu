import { describe, expect, it } from "vitest"
import { ALERTAS, PAINEL } from "./painel"
import { type Busca, conferirPainel, seriesEsperadas } from "./painel-check"

const URL_GRAFANA = "http://grafana.test"
const AGORA = 1_800_000_000_000
const VINTE_E_QUATRO_HORAS = 24 * 60 * 60 * 1000

type Resposta = { status: number; corpo?: unknown }

type Opcoes = {
  saude?: number | "lanca"
  painel?: number
  regras?: string[]
  series?: string[] | number
  comDadosEm?: string
}

/** Busca falsa: responde por URL e registra os pedidos de consulta de métrica. */
function grafanaFalso(opts: Opcoes = {}) {
  const pedidos: {
    url: string
    corpo: { from: string; to: string; queries: { expr: string; datasource: { uid: string } }[] }
  }[] = []
  const busca: Busca = async (url, init) => {
    const r = responder(url, init?.body, opts, pedidos)
    if (r === "lanca") throw new Error("ECONNREFUSED")
    return { status: r.status, json: async () => r.corpo }
  }
  return { busca, pedidos }
}

function responder(
  url: string,
  body: string | undefined,
  opts: Opcoes,
  pedidos: { url: string; corpo: unknown }[],
): Resposta | "lanca" {
  const caminho = url.replace(URL_GRAFANA, "")
  if (caminho === "/api/health") {
    if (opts.saude === "lanca") return "lanca"
    return { status: opts.saude ?? 200, corpo: { database: "ok" } }
  }
  if (caminho === "/api/dashboards/uid/ritu") {
    return { status: opts.painel ?? 200, corpo: { dashboard: {} } }
  }
  if (caminho === "/api/v1/provisioning/alert-rules") {
    const uids = opts.regras ?? ALERTAS.map((a) => a.uid)
    return { status: 200, corpo: uids.map((uid) => ({ uid })) }
  }
  if (caminho === "/api/ds/query") {
    const corpo = JSON.parse(body ?? "{}")
    pedidos.push({ url, corpo })
    const expr = corpo.queries[0].expr as string
    const comDados = opts.comDadosEm !== undefined && expr.includes(opts.comDadosEm)
    return { status: 200, corpo: resultado(comDados) }
  }
  if (caminho === "/api/datasources/proxy/uid/prometheus/api/v1/label/__name__/values") {
    const nomes = Array.isArray(opts.series) ? opts.series : []
    return { status: 200, corpo: { status: "success", data: nomes } }
  }
  return { status: 404 }
}

function resultado(comDados: boolean) {
  const frames = comDados
    ? [{ data: { values: [[AGORA], [3]] } }]
    : [{ data: { values: [[], []] } }]
  return { results: { A: { frames } } }
}

const SERIES_DO_PAINEL = seriesEsperadas()

describe("seriesEsperadas", () => {
  it("inclui os nomes de contador e medidor, e os sufixos _bucket, _count e _sum dos histogramas", () => {
    expect(SERIES_DO_PAINEL).toContain("ritu_run_passos_count")
    expect(SERIES_DO_PAINEL).toContain("ritu_run_passos_bucket")
    expect(SERIES_DO_PAINEL).toContain("ritu_run_passos_sum")
    expect(SERIES_DO_PAINEL).toContain("ritu_tokens_total")
    expect(SERIES_DO_PAINEL).toContain("ritu_llm_cota_usada")
    expect(SERIES_DO_PAINEL).not.toContain("ritu_run_passos")
  })
})

describe("conferirPainel", () => {
  it("Grafana fora do ar: código 2 e uma linha dizendo que não responde", async () => {
    const { busca } = grafanaFalso({ saude: "lanca" })
    const r = await conferirPainel({ url: URL_GRAFANA, busca, agora: AGORA })
    expect(r.codigo).toBe(2)
    expect(r.linhas).toEqual([`Grafana não responde em ${URL_GRAFANA}`])
  })

  it("health que não responde 200 também conta como fora do ar", async () => {
    const { busca } = grafanaFalso({ saude: 503 })
    const r = await conferirPainel({ url: URL_GRAFANA, busca, agora: AGORA })
    expect(r.codigo).toBe(2)
    expect(r.linhas).toEqual([`Grafana não responde em ${URL_GRAFANA}`])
  })

  it("painel ausente: código 1 com uma linha para o painel", async () => {
    const { busca } = grafanaFalso({ painel: 404, series: [] })
    const r = await conferirPainel({ url: URL_GRAFANA, busca, agora: AGORA })
    expect(r.codigo).toBe(1)
    expect(r.linhas).toContain(`Painel "${PAINEL.uid}" ausente no Grafana`)
  })

  it("regras de alerta faltando: código 1 com uma linha por regra ausente", async () => {
    const presentes = ALERTAS.slice(0, 3).map((a) => a.uid)
    const { busca } = grafanaFalso({ regras: presentes, series: [] })
    const r = await conferirPainel({ url: URL_GRAFANA, busca, agora: AGORA })
    expect(r.codigo).toBe(1)
    expect(r.linhas).toContain("Alerta ausente: ritu-429")
    expect(r.linhas).toContain("Alerta ausente: ritu-juiz-reprovando")
    expect(r.linhas.filter((l) => l.startsWith("Alerta ausente"))).toHaveLength(2)
  })

  it("tudo presente, com um painel com dados e outro sem: código 0 e uma linha por painel", async () => {
    const { busca } = grafanaFalso({
      comDadosEm: "ritu_run_passos_count",
      series: ["ritu_run_passos_count"],
    })
    const r = await conferirPainel({ url: URL_GRAFANA, busca, agora: AGORA })
    expect(r.codigo).toBe(0)
    expect(r.linhas).toContain("1. Saúde · Runs por hora: com dados")
    expect(r.linhas).toContain("1. Saúde · 429 do modelo: sem dados")
  })

  it("não consulta os painéis de logs", async () => {
    const { busca } = grafanaFalso({ series: [] })
    const r = await conferirPainel({ url: URL_GRAFANA, busca, agora: AGORA })
    expect(r.linhas.some((l) => l.includes("Avisos e erros"))).toBe(false)
  })

  it("consulta cada painel de métricas nas últimas 24 h, no datasource de métricas", async () => {
    const { busca, pedidos } = grafanaFalso({ series: [] })
    await conferirPainel({ url: URL_GRAFANA, busca, agora: AGORA })
    const metricas = PAINEL.linhas.flatMap((l) => l.paineis).filter((p) => p.fonte === "metricas")
    expect(pedidos).toHaveLength(metricas.length)
    for (const pedido of pedidos) {
      expect(pedido.url).toBe(`${URL_GRAFANA}/api/ds/query`)
      expect(pedido.corpo.from).toBe(String(AGORA - VINTE_E_QUATRO_HORAS))
      expect(pedido.corpo.to).toBe(String(AGORA))
      expect(pedido.corpo.queries.every((q) => q.datasource.uid === "prometheus")).toBe(true)
    }
  })

  it("séries que faltam e que sobram: lista as esperadas ausentes e as existentes fora do painel", async () => {
    const { busca } = grafanaFalso({
      series: ["ritu_run_passos_count", "ritu_fora_do_painel_total"],
    })
    const r = await conferirPainel({ url: URL_GRAFANA, busca, agora: AGORA })
    expect(r.linhas).toContain("Série esperada ausente: ritu_llm_duracao_ms_bucket")
    expect(r.linhas).toContain("Série fora do painel: ritu_fora_do_painel_total")
    expect(r.linhas).not.toContain("Série esperada ausente: ritu_run_passos_count")
    expect(r.linhas).not.toContain("Série fora do painel: ritu_run_passos_count")
  })

  it("Grafana no ar e nenhuma série ritu_*: todos os painéis sem dados e código 0", async () => {
    const { busca } = grafanaFalso({ series: [] })
    const r = await conferirPainel({ url: URL_GRAFANA, busca, agora: AGORA })
    expect(r.codigo).toBe(0)
    expect(r.linhas.filter((l) => l.endsWith(": com dados"))).toHaveLength(0)
    expect(r.linhas).toContain("1. Saúde · Runs por hora: sem dados")
    expect(r.linhas).toContain("Série esperada ausente: ritu_run_passos_count")
  })
})
