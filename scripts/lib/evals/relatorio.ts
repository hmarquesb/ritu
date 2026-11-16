// Relatório de uma rodada do eval com LLM (spec 014). Só recebe resultados dos casos: nenhum texto de resposta entra aqui.
import type { Papel } from "../../../config/llm-cotas"
import { TITULO_DA_FAMILIA } from "../../../evals/llm/tipos"
import type { MotivoDoJuiz } from "../../../src/core/agents/judge/saida"
import type { EntradaDoHistorico } from "./historico"
import { type Meta, textoDaMeta } from "./metas"
import { DEFINICAO_DAS_METRICAS, type Forma, type Medida, type MetricaId } from "./metricas"
import type { ResultadoDoCaso, UsoDoPapel } from "./resultado"

const TRACO = "—"
const MENOS = "−"

type Relatorio = {
  checkpoint: string
  data: string
  prompts: Record<string, string>
  modelos: string[]
  resultados: ResultadoDoCaso[]
  totalDeCasos: number
  metricas: Record<MetricaId, Medida>
  avaliacao: { abaixo: MetricaId[]; criticas: MetricaId[] }
  metas: Record<string, Meta>
  anterior?: EntradaDoHistorico
}

function numeroTexto(valor: number, forma: Forma): string {
  if (forma === "taxa") return `${Math.round(valor * 100)}%`
  if (forma === "media") return valor.toFixed(2).replace(".", ",")
  if (forma === "ms") return `${Math.round(valor)} ms`
  return String(Math.round(valor))
}

/** Valor sem a fração: `83%`, `1,50`, `3426 ms`. `null` vira `—`. */
function numeroDe(medida: Medida | undefined, forma: Forma): string {
  if (medida === undefined || medida.valor === null) return TRACO
  return numeroTexto(medida.valor, forma)
}

function fracaoDe(medida: Medida | undefined): string {
  if (medida?.parte === undefined || medida.total === undefined) return ""
  return ` (${medida.parte}/${medida.total})`
}

/** Valor com a fração da taxa: `83% (10/12)`. */
function valorTexto(medida: Medida | undefined, forma: Forma): string {
  const texto = numeroDe(medida, forma)
  return forma === "taxa" && texto !== TRACO ? `${texto}${fracaoDe(medida)}` : texto
}

const UNIDADE_DA_VARIACAO: Partial<Record<Forma, string>> = { taxa: " p.p.", ms: " ms" }

/** Arredonda na unidade de exibição; a variação sai com sinal, e zero sem sinal. */
function variacaoTexto(delta: number, forma: Forma): string {
  let unidade = Math.round(delta)
  if (forma === "taxa") unidade = Math.round(delta * 100)
  if (forma === "media") unidade = Number(delta.toFixed(2))
  const sinal = unidade > 0 ? "+" : unidade < 0 ? MENOS : ""
  const absoluto = Math.abs(unidade)
  const base = forma === "media" ? absoluto.toFixed(2).replace(".", ",") : String(absoluto)
  return `${sinal}${base}${UNIDADE_DA_VARIACAO[forma] ?? ""}`
}

function variacaoDe(atual: Medida, anterior: Medida | undefined, forma: Forma): string {
  if (anterior === undefined || anterior.valor === null || atual.valor === null) return TRACO
  return variacaoTexto(atual.valor - anterior.valor, forma)
}

const linhaDaTabela = (celulas: string[]): string => `| ${celulas.join(" | ")} |`

function tabela(cabecalho: string[], linhas: string[][]): string[] {
  const separador = `|${cabecalho.map(() => "---").join("|")}|`
  return [linhaDaTabela(cabecalho), separador, ...linhas.map(linhaDaTabela)]
}

function secao(titulo: string, corpo: string[]): string[] {
  return [`## ${titulo}`, "", ...corpo]
}

const NENHUMA = ["Nenhuma."]
const NENHUM = ["Nenhum."]

/** Linha de resumo: os números que a spec quer ver de relance. */
export function linhaDeResumo(m: Record<MetricaId, Medida>): string {
  return [
    `trajetória correta: ${numeroDe(m["trajetoria.correta"], "taxa")}`,
    `motivos fiéis: ${numeroDe(m["fidelidade.motivos_fieis"], "taxa")}`,
    `corrigiu após violação: ${numeroDe(m["autocorrecao.corrigiu"], "taxa")}`,
    `injection bloqueada: ${numeroDe(m["seguranca.injection_bloqueada"], "taxa")}`,
    `chamadas por run: ${numeroDe(m["custo.chamadas_decisao_por_run"], "media")}`,
  ].join(" · ")
}

function cabecalhoDoRelatorio(p: Relatorio): string[] {
  const prompts = Object.entries(p.prompts).map(([chave, versao]) => `${chave}: ${versao}`)
  return [
    `# Eval com LLM: ${p.checkpoint}`,
    "",
    `- Data: ${p.data}`,
    `- Prompts: ${prompts.length === 0 ? TRACO : prompts.join(", ")}`,
    `- Modelos: ${p.modelos.length === 0 ? TRACO : p.modelos.join(", ")}`,
    `- Casos rodados: ${p.resultados.length} de ${p.totalDeCasos}`,
  ]
}

const nomeDaMetrica = (id: MetricaId): string => {
  const definicao = DEFINICAO_DAS_METRICAS[id]
  return `${TITULO_DA_FAMILIA[definicao.familia]}: ${definicao.titulo}`
}

function linhaDeLista(p: Relatorio, id: MetricaId): string {
  const forma = DEFINICAO_DAS_METRICAS[id].forma
  const meta = textoDaMeta(p.metas[id], forma)
  return `- ${nomeDaMetrica(id)}: ${valorTexto(p.metricas[id], forma)} (meta ${meta})`
}

function secaoCriticas(p: Relatorio): string[] | undefined {
  if (p.avaliacao.criticas.length === 0) return undefined
  return secao(
    "Falhas críticas",
    p.avaliacao.criticas.map((id) => linhaDeLista(p, id)),
  )
}

function secaoAbaixo(p: Relatorio): string[] | undefined {
  const abaixo = p.avaliacao.abaixo.filter((id) => !p.avaliacao.criticas.includes(id))
  if (abaixo.length === 0) return undefined
  return secao(
    "Abaixo da meta",
    abaixo.map((id) => linhaDeLista(p, id)),
  )
}

function linhaDaMetrica(p: Relatorio, id: MetricaId): string[] {
  const { familia, titulo, forma } = DEFINICAO_DAS_METRICAS[id]
  const atual = p.metricas[id]
  const abaixo = p.avaliacao.abaixo.includes(id) && atual.valor !== null ? " ⚠" : ""
  return [
    TITULO_DA_FAMILIA[familia],
    titulo,
    `${valorTexto(atual, forma)}${abaixo}`,
    textoDaMeta(p.metas[id], forma),
    valorTexto(p.anterior?.metricas[id], forma),
    variacaoDe(atual, p.anterior?.metricas[id], forma),
  ]
}

function secaoMetricas(p: Relatorio): string[] {
  const ids = Object.keys(DEFINICAO_DAS_METRICAS) as MetricaId[]
  const cabecalho = ["Família", "Métrica", "Resultado", "Meta", "Anterior", "Variação"]
  return secao(
    "Métricas por família",
    tabela(
      cabecalho,
      ids.map((id) => linhaDaMetrica(p, id)),
    ),
  )
}

function secaoViolacoes(resultados: ResultadoDoCaso[]): string[] {
  const contagem = new Map<string, number>()
  for (const resultado of resultados) {
    for (const codigo of resultado.run?.violacoesDa1a ?? []) {
      contagem.set(codigo, (contagem.get(codigo) ?? 0) + 1)
    }
  }
  const ordenadas = [...contagem].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  if (ordenadas.length === 0) return secao("Violações da 1ª entrega", NENHUMA)
  const linhas = ordenadas.map(([codigo, runs]) => [codigo, String(runs)])
  return secao("Violações da 1ª entrega", tabela(["Código", "Runs"], linhas))
}

const contaNaLista = (listas: MotivoDoJuiz[][], motivo: MotivoDoJuiz): number =>
  listas.filter((lista) => lista.includes(motivo)).length

function secaoJuiz(resultados: ResultadoDoCaso[]): string[] | undefined {
  const casos = resultados.filter((r) => r.tipo === "juiz")
  if (casos.length === 0) return undefined
  const esperados = casos.map((c) => c.juiz?.esperados ?? [])
  const devolvidos = casos.map((c) => c.juiz?.devolvidos ?? [])
  const motivos = [...new Set([...esperados.flat(), ...devolvidos.flat()])].sort()
  if (motivos.length === 0) return secao("Juiz por motivo", NENHUMA)
  const linhas = motivos.map((motivo) => [
    motivo,
    String(contaNaLista(esperados, motivo)),
    String(contaNaLista(devolvidos, motivo)),
  ])
  return secao("Juiz por motivo", tabela(["Motivo", "Esperado", "Veio"], linhas))
}

function somarUsos(usos: (UsoDoPapel | undefined)[]): UsoDoPapel {
  return usos.reduce<UsoDoPapel>(
    (total, uso) => ({
      chamadas: total.chamadas + (uso?.chamadas ?? 0),
      tokens_entrada: total.tokens_entrada + (uso?.tokens_entrada ?? 0),
      tokens_saida: total.tokens_saida + (uso?.tokens_saida ?? 0),
    }),
    { chamadas: 0, tokens_entrada: 0, tokens_saida: 0 },
  )
}

const linhaDeUso = (nome: string, uso: UsoDoPapel): string[] => [
  nome,
  String(uso.chamadas),
  String(uso.tokens_entrada),
  String(uso.tokens_saida),
]

function secaoCusto(resultados: ResultadoDoCaso[]): string[] {
  const papeis = [...new Set(resultados.flatMap((r) => Object.keys(r.uso)))].sort()
  const linhas = papeis.map((papel) =>
    linhaDeUso(papel, somarUsos(resultados.map((r) => r.uso[papel as Papel]))),
  )
  linhas.push(linhaDeUso("avaliador", somarUsos(resultados.map((r) => r.usoDoAvaliador))))
  return secao(
    "Custo por papel",
    tabela(["Papel", "Chamadas", "Tokens de entrada", "Tokens de saída"], linhas),
  )
}

function situacaoDoCaso(resultado: ResultadoDoCaso): string {
  if (resultado.erro !== undefined) return "erro"
  return resultado.acertou ? "certo" : "errado"
}

function linhaDoCaso(resultado: ResultadoDoCaso): string[] {
  const familias = resultado.familias.map((f) => TITULO_DA_FAMILIA[f]).join(", ")
  return [
    resultado.id,
    resultado.tipo,
    familias === "" ? TRACO : familias,
    situacaoDoCaso(resultado),
    `${resultado.latenciaMs} ms`,
  ]
}

function secaoCasos(resultados: ResultadoDoCaso[]): string[] {
  const linhas = resultados.map(linhaDoCaso)
  return secao("Casos", tabela(["Caso", "Tipo", "Famílias", "Certo", "Latência"], linhas))
}

function linhasDeFalha(resultado: ResultadoDoCaso): string[] {
  const checagens = resultado.checagens
    .filter((c) => c.ok === false)
    .map((c) => `- ${resultado.id}: ${c.lista}: ${c.descricao}`)
  const trajetoria =
    resultado.run?.trajetoriaOk === false ? [`- ${resultado.id}: trajetória fora do esperado`] : []
  return [...checagens, ...trajetoria]
}

function secaoFalhas(resultados: ResultadoDoCaso[]): string[] {
  const linhas = resultados.flatMap(linhasDeFalha)
  return secao("Falhas", linhas.length === 0 ? NENHUMA : linhas)
}

function secaoErros(resultados: ResultadoDoCaso[]): string[] {
  const linhas = resultados.flatMap((r) => (r.erro === undefined ? [] : [`- ${r.id}: ${r.erro}`]))
  return secao("Erros", linhas.length === 0 ? NENHUM : linhas)
}

/** Seções na ordem da spec. Seção sem conteúdo não aparece. */
export function formatarRelatorio(p: Relatorio): string {
  const blocos: (string[] | undefined)[] = [
    cabecalhoDoRelatorio(p),
    [linhaDeResumo(p.metricas)],
    secaoCriticas(p),
    secaoAbaixo(p),
    secaoMetricas(p),
    secaoViolacoes(p.resultados),
    secaoJuiz(p.resultados),
    secaoCusto(p.resultados),
    secaoCasos(p.resultados),
    secaoFalhas(p.resultados),
    secaoErros(p.resultados),
  ]
  const presentes = blocos.filter((bloco): bloco is string[] => bloco !== undefined)
  return `${presentes.map((bloco) => bloco.join("\n")).join("\n\n")}\n`
}
