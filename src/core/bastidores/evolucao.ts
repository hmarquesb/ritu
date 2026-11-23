// Evolução dos evals na página Bastidores: monta os gráficos e a tabela a partir de `historico.json` (spec 023).
import { config, textosBastidores } from "@config/index"
import type { Historico } from "@/core/evals/historico"

export type FormatoDaMetrica = "pct" | "num" | "ms" | "contagem"

export type Ponto = {
  checkpoint: string
  curto: string
  data: string
  valor: number | null
  abaixo: boolean
}

export type Grafico = {
  id: string
  rotulo: string
  formato: FormatoDaMetrica
  meta?: { tipo: "min" | "max"; valor: number }
  pontos: Ponto[]
  atual: Ponto | undefined
}

export type LinhaDaTabela = {
  id: string
  rotulo: string
  formato: FormatoDaMetrica
  valores: { valor: number | null; abaixo: boolean }[]
}

export type Evolucao =
  | { tipo: "vazia" }
  | {
      tipo: "ok"
      checkpoints: { checkpoint: string; curto: string; data: string }[]
      graficos: Grafico[]
      tabela: { familia: string; rotulo: string; linhas: LinhaDaTabela[] }[]
    }

type Metrica = (typeof textosBastidores.metricas)[number]
type Checkpoint = Historico["checkpoints"][number]
type Meta = NonNullable<Grafico["meta"]>

// Ordem das famílias: a mesma de FAMILIAS (014), que é a ordem de textosBastidores.familias.
const FAMILIAS: readonly string[] = Object.keys(textosBastidores.familias)
const METRICAS: readonly Metrica[] = textosBastidores.metricas
const ROTULOS_DA_FAMILIA: Readonly<Record<string, string>> = textosBastidores.familias
const CURTOS: Readonly<Record<string, string>> = textosBastidores.checkpoints
const TEXTOS_DA_META = textosBastidores.evals.meta

export function formatarMetrica(valor: number | null, formato: FormatoDaMetrica): string {
  if (valor === null) return "—"
  if (formato === "pct") return `${Math.round(valor * 100)}%`
  if (formato === "num") return String(Math.round(valor * 10) / 10).replace(".", ",")
  if (formato === "ms") return `${String(Math.round(valor / 100) / 10).replace(".", ",")} s`
  return String(Math.round(valor))
}

function metaDe(id: string, metas: typeof config.evals.metas): Meta | undefined {
  const regra: Readonly<Record<string, { min?: number; max?: number } | undefined>> = metas
  const da = regra[id]
  if (da?.min !== undefined) return { tipo: "min", valor: da.min }
  if (da?.max !== undefined) return { tipo: "max", valor: da.max }
  return undefined
}

function pontoDe(c: Checkpoint, id: string): Ponto {
  return {
    checkpoint: c.checkpoint,
    curto: CURTOS[c.checkpoint] ?? c.checkpoint,
    data: c.data,
    valor: c.metricas[id]?.valor ?? null,
    abaixo: c.abaixo_da_meta.includes(id),
  }
}

function atualDe(pontos: Ponto[]): Ponto | undefined {
  return [...pontos].reverse().find((p) => p.valor !== null)
}

function montarGrafico(
  metrica: Metrica,
  checkpoints: Checkpoint[],
  metas: typeof config.evals.metas,
): Grafico {
  const pontos = checkpoints.map((c) => pontoDe(c, metrica.id))
  const meta = metaDe(metrica.id, metas)
  return {
    id: metrica.id,
    rotulo: metrica.rotulo,
    formato: metrica.formato,
    ...(meta ? { meta } : {}),
    pontos,
    atual: atualDe(pontos),
  }
}

function linhaDaTabela(metrica: Metrica, checkpoints: Checkpoint[]): LinhaDaTabela {
  return {
    id: metrica.id,
    rotulo: metrica.rotulo,
    formato: metrica.formato,
    valores: checkpoints.map((c) => ({
      valor: c.metricas[metrica.id]?.valor ?? null,
      abaixo: c.abaixo_da_meta.includes(metrica.id),
    })),
  }
}

export function montarEvolucao(h: Historico, metas: typeof config.evals.metas): Evolucao {
  const checkpoints = h.checkpoints
  if (checkpoints.length === 0) return { tipo: "vazia" }

  const graficos = config.bastidores.destaques.flatMap((id) => {
    const metrica = METRICAS.find((m) => m.id === id)
    return metrica ? [montarGrafico(metrica, checkpoints, metas)] : []
  })

  const tabela = FAMILIAS.flatMap((familia) => {
    const linhas = METRICAS.filter((m) => m.id.split(".")[0] === familia).map((m) =>
      linhaDaTabela(m, checkpoints),
    )
    if (linhas.length === 0) return []
    return [{ familia, rotulo: ROTULOS_DA_FAMILIA[familia] ?? familia, linhas }]
  })

  return {
    tipo: "ok",
    checkpoints: checkpoints.map((c) => ({
      checkpoint: c.checkpoint,
      curto: CURTOS[c.checkpoint] ?? c.checkpoint,
      data: c.data,
    })),
    graficos,
    tabela,
  }
}

export function rotuloDoGrafico(g: Grafico): string {
  const pontos = g.pontos.map((p) => {
    if (p.valor === null) return `${p.curto} ${textosBastidores.evals.semValor}`
    const texto = `${p.curto} ${formatarMetrica(p.valor, g.formato)}`
    return p.abaixo ? `${texto} (${textosBastidores.evals.abaixo})` : texto
  })
  const partes = [`${g.rotulo}: ${pontos.join(", ")}.`]
  if (g.meta) {
    const meta = TEXTOS_DA_META[g.meta.tipo].replace(
      "{valor}",
      formatarMetrica(g.meta.valor, g.formato),
    )
    partes.push(`${meta}.`)
  }
  return partes.join(" ")
}
