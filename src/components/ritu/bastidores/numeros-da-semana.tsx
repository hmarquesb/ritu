import { textosBastidores } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { StateBlock } from "@/components/base/state-block"
import { Surface } from "@/components/base/surface"
import { Barras, type ItemDeBarra } from "@/components/ritu/bastidores/barras"
import { dataCurta } from "@/components/ritu/bastidores/datas"
import type { FormatarValor } from "@/components/ritu/bastidores/grafico-evolucao"
import type { NumerosDaSemana as Numeros } from "@/core/bastidores/numeros"

const T = textosBastidores
const NOME_DA_INTENCAO: Readonly<Record<string, string>> = T.intencoes

type Ok = Extract<Numeros, { tipo: "ok" }>
type Indicador = { id: string; rotulo: string; valor: string; nota?: string; grande: boolean }

function indicadores({ runs, sinais }: Ok, formatarMetrica: FormatarValor): Indicador[] {
  const juiz = runs.juiz.julgados === 0 ? null : runs.juiz.refeitas / runs.juiz.julgados
  return [
    {
      id: "conversas",
      ...T.tile.conversas,
      valor: formatarMetrica(runs.runs, "contagem"),
      grande: true,
    },
    {
      id: "duracao",
      ...T.tile.duracao,
      valor: formatarMetrica(runs.duracao_p50_ms, "ms"),
      grande: true,
    },
    {
      id: "passos",
      ...T.tile.passos,
      valor: formatarMetrica(runs.passos_medios, "num"),
      grande: true,
    },
    { id: "juiz", ...T.tile.juiz, valor: formatarMetrica(juiz, "pct"), grande: true },
    {
      id: "trocas",
      ...T.tile.trocas,
      valor: formatarMetrica(runs.trocas_de_modelo, "contagem"),
      grande: true,
    },
    {
      id: "votos",
      rotulo: T.tile.votos.rotulo,
      valor: formatar(T.tile.votos.valor, sinais.feedback),
      grande: false,
    },
    {
      id: "retornos",
      rotulo: T.tile.retornos.rotulo,
      valor: formatar(T.tile.retornos.valor, sinais.retornos),
      grande: false,
    },
  ]
}

function intencoes({ runs }: Ok): ItemDeBarra[] {
  const soma = runs.intencoes.reduce((s, i) => s + i.total, 0)
  return runs.intencoes.map((i) => ({
    rotulo: NOME_DA_INTENCAO[i.intencao] ?? i.intencao,
    total: i.total,
    porcentagem: soma === 0 ? 0 : Math.round((i.total / soma) * 100),
  }))
}

function Tile({ item }: { item: Indicador }) {
  return (
    <Surface
      tone="surface"
      radius="lg"
      padding="md"
      className="flex flex-col justify-between gap-3 border border-line"
    >
      <dt className="text-body font-medium text-ink">{item.rotulo}</dt>
      <dd className="flex flex-col gap-1">
        <span
          className={
            item.grande
              ? "font-title text-title font-semibold tabular-nums text-ink"
              : "font-title text-title-sm font-semibold text-ink"
          }
        >
          {item.valor}
        </span>
        {item.nota ? <span className="text-sm text-ink-muted">{item.nota}</span> : null}
      </dd>
    </Surface>
  )
}

/** Seção "Últimos 7 dias". `numeros` ausente é o banco fora do ar. */
export function NumerosDaSemana({
  numeros,
  formatarMetrica,
}: {
  numeros: Numeros | undefined
  formatarMetrica: FormatarValor
}) {
  if (numeros === undefined) {
    return <StateBlock kind="error" title={T.semana.erro} />
  }
  if (numeros.tipo === "poucos") {
    return (
      <StateBlock
        kind="empty"
        title={T.semana.poucos.titulo}
        description={formatar(T.semana.poucos.texto, {
          minimo: numeros.minimo,
          runs: numeros.runs,
        })}
      />
    )
  }
  const tools: ItemDeBarra[] = numeros.runs.tools.map((t) => ({ rotulo: t.tool, total: t.total }))
  return (
    <div className="flex flex-col gap-8">
      <p className="text-body text-ink-muted">
        {formatar(T.semana.janela, {
          de: dataCurta(numeros.janela.de),
          ate: dataCurta(numeros.janela.ate),
        })}
      </p>
      <dl className="grid grid-cols-1 gap-3 min-[30rem]:grid-cols-2 min-[48rem]:grid-cols-3">
        {indicadores(numeros, formatarMetrica).map((item) => (
          <Tile key={item.id} item={item} />
        ))}
      </dl>
      <div className="grid grid-cols-1 gap-8 min-[48rem]:grid-cols-2">
        <Barras titulo={T.intencoes.titulo} itens={intencoes(numeros)} />
        <Barras titulo={T.tools.titulo} itens={tools} />
      </div>
    </div>
  )
}
