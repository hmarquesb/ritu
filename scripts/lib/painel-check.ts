import { telemetria } from "@config/telemetria"
import { METRICAS } from "@/core/telemetry/nomes"
import { ALERTAS, PAINEL, type Painel } from "./painel"

export type Busca = (
  url: string,
  init?: { method?: string; body?: string; headers?: Record<string, string> },
) => Promise<{ status: number; json(): Promise<unknown> }>

type Resposta = { status: number; corpo: unknown }

type Resultado = {
  results?: Record<string, { frames?: { data?: { values?: unknown[][] } }[] }>
}

const VINTE_E_QUATRO_HORAS = 24 * 60 * 60 * 1000
const PASSO_MS = 60_000
const MAXIMO_DE_PONTOS = 500

/** Nomes das séries que o painel espera: histogramas expõem _bucket, _count e _sum. */
export function seriesEsperadas(): string[] {
  return Object.entries(METRICAS).flatMap(([nome, definicao]) =>
    definicao.tipo === "histograma" ? [`${nome}_bucket`, `${nome}_count`, `${nome}_sum`] : [nome],
  )
}

/** Confere o painel do Grafana: saúde, painel, regras de alerta, dados por painel e séries. */
export async function conferirPainel(p: {
  url: string
  busca: Busca
  agora: number
}): Promise<{ codigo: 0 | 1 | 2; linhas: string[] }> {
  if (!(await grafanaNoAr(p.url, p.busca))) {
    return { codigo: 2, linhas: [`Grafana não responde em ${p.url}`] }
  }
  const ausencias = [
    ...(await conferirDashboard(p.url, p.busca)),
    ...(await conferirAlertas(p.url, p.busca)),
  ]
  const paineis = await conferirPaineis(p)
  const series = await conferirSeries(p.url, p.busca)
  return { codigo: ausencias.length > 0 ? 1 : 0, linhas: [...ausencias, ...paineis, ...series] }
}

async function pedir(busca: Busca, url: string, init?: Parameters<Busca>[1]): Promise<Resposta> {
  try {
    const r = await busca(url, init)
    return { status: r.status, corpo: await r.json() }
  } catch {
    return { status: 0, corpo: undefined }
  }
}

async function grafanaNoAr(url: string, busca: Busca): Promise<boolean> {
  try {
    const r = await busca(`${url}/api/health`)
    return r.status === 200
  } catch {
    return false
  }
}

async function conferirDashboard(url: string, busca: Busca): Promise<string[]> {
  const r = await pedir(busca, `${url}/api/dashboards/uid/${PAINEL.uid}`)
  return r.status === 200 ? [] : [`Painel "${PAINEL.uid}" ausente no Grafana`]
}

async function conferirAlertas(url: string, busca: Busca): Promise<string[]> {
  const r = await pedir(busca, `${url}/api/v1/provisioning/alert-rules`)
  const regras = Array.isArray(r.corpo) ? (r.corpo as { uid?: unknown }[]) : []
  const uids = regras.map((regra) => regra.uid)
  return ALERTAS.filter((alerta) => !uids.includes(alerta.uid)).map(
    (alerta) => `Alerta ausente: ${alerta.uid}`,
  )
}

function colunasDeValor(colunas: unknown[][]): unknown[][] {
  return colunas.length > 1 ? colunas.slice(1) : colunas
}

/** Um quadro tem valores quando alguma coluna de valor tem algo que não é nulo. */
function temValores(corpo: unknown): boolean {
  const resultados = Object.values((corpo as Resultado | undefined)?.results ?? {})
  return resultados.some((resultado) =>
    (resultado.frames ?? []).some((quadro) =>
      colunasDeValor(quadro.data?.values ?? []).some((coluna) =>
        coluna.some((valor) => valor !== null && valor !== undefined),
      ),
    ),
  )
}

async function consultarPainel(
  p: { url: string; busca: Busca; agora: number },
  painel: Painel,
): Promise<boolean> {
  const corpo = {
    from: String(p.agora - VINTE_E_QUATRO_HORAS),
    to: String(p.agora),
    queries: painel.consultas.map((consulta, i) => ({
      refId: String.fromCharCode(65 + i),
      datasource: { uid: telemetria.grafana.uidMetricas },
      expr: consulta.expr,
      range: true,
      instant: false,
      intervalMs: PASSO_MS,
      maxDataPoints: MAXIMO_DE_PONTOS,
    })),
  }
  const r = await pedir(p.busca, `${p.url}/api/ds/query`, {
    method: "POST",
    body: JSON.stringify(corpo),
    headers: { "Content-Type": "application/json" },
  })
  return r.status === 200 && temValores(r.corpo)
}

async function conferirPaineis(p: { url: string; busca: Busca; agora: number }): Promise<string[]> {
  const itens = PAINEL.linhas.flatMap((linha) =>
    linha.paineis
      .filter((painel) => painel.fonte === "metricas")
      .map((painel) => ({ linha: linha.titulo, painel })),
  )
  const resultados = await Promise.all(itens.map(({ painel }) => consultarPainel(p, painel)))
  return itens.map(
    ({ linha, painel }, i) =>
      `${linha} · ${painel.titulo}: ${resultados[i] ? "com dados" : "sem dados"}`,
  )
}

function ritusDe(corpo: unknown): string[] {
  const nomes = (corpo as { data?: unknown } | undefined)?.data
  if (!Array.isArray(nomes)) return []
  return nomes.filter(
    (nome): nome is string => typeof nome === "string" && nome.startsWith("ritu_"),
  )
}

async function conferirSeries(url: string, busca: Busca): Promise<string[]> {
  const r = await pedir(
    busca,
    `${url}/api/datasources/proxy/uid/${telemetria.grafana.uidMetricas}/api/v1/label/__name__/values`,
  )
  const existentes = ritusDe(r.corpo)
  const expressoes = PAINEL.linhas.flatMap((linha) =>
    linha.paineis.flatMap((painel) => painel.consultas.map((consulta) => consulta.expr)),
  )
  const ausentes = seriesEsperadas()
    .filter((nome) => !existentes.includes(nome))
    .map((nome) => `Série esperada ausente: ${nome}`)
  const foraDoPainel = existentes
    .filter((nome) => !expressoes.some((expr) => expr.includes(nome)))
    .map((nome) => `Série fora do painel: ${nome}`)
  return [...ausentes, ...foraDoPainel]
}
