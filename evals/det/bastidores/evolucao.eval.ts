import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { config, textosBastidores } from "@config/index"
import { describe, expect, it } from "vitest"
import { type FormatoDaMetrica, montarEvolucao } from "@/core/bastidores/evolucao"
import { type Historico, historicoSchema } from "@/core/evals/historico"
import { gerarComparacao } from "../../../scripts/lib/evals/comparacao"
import { DEFINICAO_DAS_METRICAS } from "../../../scripts/lib/evals/metricas"

// A raiz do repositório: evals/det/bastidores/ está três níveis abaixo dela.
const RAIZ = new URL("../../../", import.meta.url)

const historico: Historico = historicoSchema.parse(
  JSON.parse(readFileSync(fileURLToPath(new URL("evals/resultados/historico.json", RAIZ)), "utf8")),
)

const comparacao = gerarComparacao(historico)
const linhasDaTabela = comparacao.split("\n").filter((linha) => linha.startsWith("| "))
const cabecalho = linhasDaTabela.find((linha) => linha.startsWith("| Métrica |")) ?? ""
const nomesDosCheckpoints = cabecalho.slice(2, -2).split(" | ").slice(1)

// As linhas de métrica do COMPARACAO vêm em ordem de DEFINICAO_DAS_METRICAS.
const idsDoComparacao = Object.keys(DEFINICAO_DAS_METRICAS)
const linhasDeMetrica = linhasDaTabela.filter((linha) => linha.startsWith("| **"))
const celulasPorId = new Map(
  idsDoComparacao.map((id, i) => [
    id,
    (linhasDeMetrica[i] ?? "").slice(2, -2).split(" | ").slice(1),
  ]),
)

// Compara o número de uma célula do COMPARACAO com o valor da página, sem exigir o mesmo texto.
// O COMPARACAO mostra "83% (5/6)" e "2,50"; a página mostra "83%" e "2,5". O que conta é o número.
function bateCom(celula: string, valor: number | null, formato: FormatoDaMetrica): boolean {
  const abaixo = celula.endsWith(" ⚠")
  const texto = abaixo ? celula.slice(0, -2) : celula
  if (valor === null) return texto === "—"
  if (texto === "—") return false
  const achado = texto.match(/-?\d+(?:,\d+)?/)?.[0]
  if (achado === undefined) return false
  const numero = Number(achado.replace(",", "."))
  const esperado = formato === "pct" ? valor * 100 : valor
  const tolerancia = formato === "num" ? 0.05 : 0.5
  return Math.abs(numero - esperado) <= tolerancia
}

describe("evolução dos evals da página Bastidores, com o historico.json real", () => {
  const evolucao = montarEvolucao(historico, config.evals.metas)

  it("tem o mesmo conjunto de métricas que o COMPARACAO", () => {
    const ids = textosBastidores.metricas.map((m) => m.id).sort()
    expect(ids).toEqual([...idsDoComparacao].sort())
  })

  it("as colunas são os mesmos checkpoints, na mesma ordem", () => {
    if (evolucao.tipo !== "ok") throw new Error("esperava ok")
    expect(evolucao.checkpoints.map((c) => c.checkpoint)).toEqual(nomesDosCheckpoints)
  })

  it("cada valor da tabela bate com a célula de COMPARACAO.md", () => {
    if (evolucao.tipo !== "ok") throw new Error("esperava ok")
    const porId = new Map(evolucao.tabela.flatMap((t) => t.linhas).map((l) => [l.id, l]))
    for (const metrica of textosBastidores.metricas) {
      const linha = porId.get(metrica.id)
      const celulas = celulasPorId.get(metrica.id) ?? []
      expect(linha, metrica.id).toBeDefined()
      expect(celulas, metrica.id).toHaveLength(historico.checkpoints.length)
      linha?.valores.forEach((v, i) => {
        const celula = celulas[i] ?? ""
        expect(
          bateCom(celula, v.valor, metrica.formato),
          `${metrica.id} em ${nomesDosCheckpoints[i]}`,
        ).toBe(true)
        expect(celula.endsWith(" ⚠"), `${metrica.id} ⚠ em ${nomesDosCheckpoints[i]}`).toBe(
          v.valor !== null && v.abaixo,
        )
      })
    }
  })

  it("os pontos dos gráficos são os da tabela", () => {
    if (evolucao.tipo !== "ok") throw new Error("esperava ok")
    const porId = new Map(evolucao.tabela.flatMap((t) => t.linhas).map((l) => [l.id, l]))
    for (const grafico of evolucao.graficos) {
      const valores = porId.get(grafico.id)?.valores.map((v) => v.valor)
      expect(grafico.pontos.map((p) => p.valor)).toEqual(valores)
    }
  })
})
