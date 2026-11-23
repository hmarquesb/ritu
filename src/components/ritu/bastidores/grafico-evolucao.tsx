import { textosBastidores } from "@config/index"
import { Surface } from "@/components/base/surface"
import type { FormatoDaMetrica, Grafico, Ponto } from "@/core/bastidores/evolucao"

/** Formata um valor da métrica (a função vem do core, pela página). */
export type FormatarValor = (valor: number | null, formato: FormatoDaMetrica) => string

const T = textosBastidores.evals

const LARGURA = 320
const ALTURA = 140
const ESQUERDA = 36
const DIREITA = 284
const TOPO = 30
const BASE = 104
const EIXO_X = 126

function xDoPonto(indice: number, total: number): number {
  if (total <= 1) return (ESQUERDA + DIREITA) / 2
  return ESQUERDA + ((DIREITA - ESQUERDA) * indice) / (total - 1)
}

// pct vai de 0 a 100%; os demais, de 0 ao maior valor entre os pontos e a meta, com 10% de folga.
function tetoDoEixo(g: Grafico): number {
  if (g.formato === "pct") return 1
  const valores = g.pontos.flatMap((p) => (p.valor === null ? [] : [p.valor]))
  if (g.meta) valores.push(g.meta.valor)
  const maior = Math.max(...valores, 0)
  return maior > 0 ? maior * 1.1 : 1
}

function textoDaMeta(g: Grafico, formatarMetrica: FormatarValor): string | undefined {
  if (!g.meta) return undefined
  return T.meta[g.meta.tipo].replace("{valor}", formatarMetrica(g.meta.valor, g.formato))
}

function ValorAtual({ g, formatarMetrica }: { g: Grafico; formatarMetrica: FormatarValor }) {
  const atual = g.atual
  return (
    <p className="flex items-baseline gap-2">
      <span className="font-title text-title font-semibold tabular-nums text-ink">
        {formatarMetrica(atual?.valor ?? null, g.formato)}
      </span>
      {atual?.abaixo ? (
        <span className="text-sm font-medium text-amber-ink">
          <span aria-hidden="true">⚠ </span>
          {T.abaixo}
        </span>
      ) : null}
      {atual ? <span className="text-sm text-ink-muted">{atual.curto}</span> : null}
    </p>
  )
}

function PontoNoGrafico({
  ponto,
  x,
  y,
  formato,
  formatarMetrica,
}: {
  ponto: Ponto
  x: number
  y: number | undefined
  formato: Grafico["formato"]
  formatarMetrica: FormatarValor
}) {
  if (ponto.valor === null || y === undefined) {
    return (
      <text x={x} y={BASE - 10} textAnchor="middle" className="fill-ink-muted text-caption">
        —
      </text>
    )
  }
  const texto = `${ponto.abaixo ? "⚠ " : ""}${formatarMetrica(ponto.valor, formato)}`
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={4}
        strokeWidth={2}
        className={ponto.abaixo ? "fill-surface stroke-amber-ink" : "fill-primary stroke-primary"}
      />
      <text
        x={x}
        y={y - 10}
        textAnchor="middle"
        className={`text-caption tabular-nums ${ponto.abaixo ? "fill-amber-ink" : "fill-ink"}`}
      >
        {texto}
      </text>
    </g>
  )
}

/** Um gráfico de linha por métrica, em SVG no servidor, com os tokens do tema. */
export function GraficoEvolucao({
  grafico,
  rotulo,
  formatarMetrica,
}: {
  grafico: Grafico
  rotulo: string
  formatarMetrica: FormatarValor
}) {
  const total = grafico.pontos.length
  const teto = tetoDoEixo(grafico)
  const yDe = (valor: number) => BASE - (Math.min(valor, teto) / teto) * (BASE - TOPO)
  const coordenadas = grafico.pontos.map((p, i) => ({
    ponto: p,
    x: xDoPonto(i, total),
    y: p.valor === null ? undefined : yDe(p.valor),
  }))
  const caminho = coordenadas.flatMap((c) => (c.y === undefined ? [] : [`${c.x},${c.y}`])).join(" ")
  const comLinha = coordenadas.filter((c) => c.y !== undefined).length > 1
  const meta = textoDaMeta(grafico, formatarMetrica)
  const yMeta = grafico.meta ? yDe(grafico.meta.valor) : undefined

  return (
    <Surface
      as="figure"
      tone="surface"
      radius="lg"
      padding="md"
      className="m-0 flex flex-col gap-3 border border-line"
    >
      <figcaption className="flex flex-col gap-1">
        <h3 className="font-title text-title-sm font-semibold text-ink">{grafico.rotulo}</h3>
        <ValorAtual g={grafico} formatarMetrica={formatarMetrica} />
        {meta ? <p className="text-sm text-ink-muted">{meta}</p> : null}
      </figcaption>
      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        role="img"
        aria-label={rotulo}
        className="h-auto w-full"
      >
        <line
          x1={ESQUERDA - 16}
          x2={DIREITA + 16}
          y1={BASE}
          y2={BASE}
          strokeWidth={1}
          className="stroke-line"
        />
        {yMeta === undefined ? null : (
          <g>
            <line
              x1={ESQUERDA - 16}
              x2={DIREITA + 16}
              y1={yMeta}
              y2={yMeta}
              strokeWidth={1}
              strokeDasharray="4 3"
              className="stroke-line-strong"
            />
            <text
              x={DIREITA + 16}
              y={yMeta + 12}
              textAnchor="end"
              className="fill-ink-muted text-caption"
            >
              meta
            </text>
          </g>
        )}
        {comLinha ? (
          <polyline
            points={caminho}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="stroke-primary"
          />
        ) : null}
        {coordenadas.map((c) => (
          <PontoNoGrafico
            key={c.ponto.checkpoint}
            ponto={c.ponto}
            x={c.x}
            y={c.y}
            formato={grafico.formato}
            formatarMetrica={formatarMetrica}
          />
        ))}
        {coordenadas.map((c) => (
          <text
            key={`eixo-${c.ponto.checkpoint}`}
            x={c.x}
            y={EIXO_X}
            textAnchor="middle"
            className="fill-ink-muted text-caption"
          >
            {c.ponto.curto}
          </text>
        ))}
      </svg>
    </Surface>
  )
}
