// Tabela de evolução dos evals com LLM, gerada só a partir de `historico.json` (spec 014).
import { TITULO_DA_FAMILIA } from "../../../evals/llm/tipos"
import type { Historico } from "../../../src/core/evals/historico"
import type { EntradaDoHistorico } from "./historico"
import { DEFINICAO_DAS_METRICAS, type Forma, type Medida, type MetricaId } from "./metricas"

const TITULO = "# Evolução dos evals com LLM"

const APRESENTACAO =
  "Uma coluna por checkpoint e uma linha por métrica, gerada de `evals/resultados/historico.json`. O detalhe de cada rodada está em `evals/resultados/<checkpoint>.md`."

const RODAPE =
  "Em `c1-base` e `c2-conversa`, Explicação incluía 'o texto bate com as sugestões', que desde o `c3-confiavel` conta em Fidelidade."

const TRACO = "—"

function textoDoValor(medida: Medida | undefined, forma: Forma): string {
  if (medida === undefined || medida.valor === null) return TRACO
  const valor = medida.valor
  if (forma === "taxa") {
    const porcento = `${Math.round(valor * 100)}%`
    if (medida.parte === undefined || medida.total === undefined) return porcento
    return `${porcento} (${medida.parte}/${medida.total})`
  }
  if (forma === "media") return valor.toFixed(2).replace(".", ",")
  if (forma === "ms") return `${Math.round(valor)} ms`
  return String(Math.round(valor))
}

const listaOuTraco = (valores: string[]): string =>
  valores.length === 0 ? TRACO : valores.join(", ")

const linha = (rotulo: string, celulas: string[]): string =>
  `| ${[rotulo, ...celulas].join(" | ")} |`

function celulaDaMetrica(entrada: EntradaDoHistorico, id: MetricaId): string {
  const texto = textoDoValor(entrada.metricas[id], DEFINICAO_DAS_METRICAS[id].forma)
  const abaixo = entrada.abaixo_da_meta.includes(id) && texto !== TRACO
  return abaixo ? `${texto} ⚠` : texto
}

function linhaDaMetrica(id: MetricaId, entradas: EntradaDoHistorico[]): string {
  const definicao = DEFINICAO_DAS_METRICAS[id]
  const rotulo = `**${TITULO_DA_FAMILIA[definicao.familia]}**: ${definicao.titulo}`
  return linha(
    rotulo,
    entradas.map((entrada) => celulaDaMetrica(entrada, id)),
  )
}

function linhasDeIdentificacao(entradas: EntradaDoHistorico[]): string[] {
  return [
    linha(
      "Data",
      entradas.map((e) => e.data),
    ),
    linha(
      "Prompts",
      entradas.map((e) => listaOuTraco(Object.values(e.prompts))),
    ),
    linha(
      "Modelos",
      entradas.map((e) => listaOuTraco(e.modelos)),
    ),
    linha(
      "Casos",
      entradas.map((e) => String(e.casos)),
    ),
  ]
}

export function gerarComparacao(historico: Historico): string {
  const entradas = historico.checkpoints
  const cabecalho = `| Métrica | ${entradas.map((e) => e.checkpoint).join(" | ")} |`
  const separador = `|${"---|".repeat(entradas.length + 1)}`
  const metricas = (Object.keys(DEFINICAO_DAS_METRICAS) as MetricaId[]).map((id) =>
    linhaDaMetrica(id, entradas),
  )
  const linhas = [
    TITULO,
    "",
    APRESENTACAO,
    "",
    cabecalho,
    separador,
    ...linhasDeIdentificacao(entradas),
    ...metricas,
    "",
    RODAPE,
  ]
  return `${linhas.join("\n")}\n`
}
