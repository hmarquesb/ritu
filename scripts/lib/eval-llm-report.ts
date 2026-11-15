// Relatório do eval com LLM: funções puras que somam os resultados de uma rodada e formatam o Markdown.

export type ChecagemDeExpectativa = { descricao: string; ok: boolean }

export type Explicacao = {
  diz_o_que_o_momento_pede: boolean
  diz_o_que_cada_item_traz: boolean
  texto_bate_com_sugestoes: boolean
}

export type UsoDoPapel = { chamadas: number; tokens_entrada: number; tokens_saida: number }

export type ResultadoDoCaso = {
  id: string
  titulo: string
  deve: ChecagemDeExpectativa[]
  naoPode: ChecagemDeExpectativa[]
  trajetoriaOk: boolean
  chamadasDesnecessarias: number
  validaNa1a: boolean
  houveViolacao: boolean
  corrigiuAposViolacao: boolean
  explicacao?: Explicacao
  /** A chamada de apoio que avalia a explicação falhou: o caso conta, a explicação não. */
  explicacaoNaoAvaliada?: boolean
  /** Erro inesperado no caso: só a classe/código, nunca o texto. */
  erro?: string
  uso: Record<string, UsoDoPapel>
  trocas: number
  latenciaMs: number
  modelos: string[]
}

export type Rodada = {
  checkpoint: string
  promptVersao: string
  casos: ResultadoDoCaso[]
  totalDeCasos: number
  interrompidaPor?: string
}

const ordenar = (valores: number[]): number[] => [...valores].sort((a, b) => a - b)

/** Percentil pelo método do posto mais próximo; vazio dá 0. */
export function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0
  const lista = ordenar(valores)
  const posicao = Math.min(lista.length, Math.max(1, Math.ceil((p / 100) * lista.length)))
  return lista[posicao - 1] ?? 0
}

const soma = (valores: number[]): number => valores.reduce((a, b) => a + b, 0)

export const porcentagem = (parte: number, total: number): string =>
  total === 0 ? "n/d" : `${Math.round((parte / total) * 100)}%`

const todosOk = (c: ChecagemDeExpectativa[]): boolean => c.every((x) => x.ok)

export type ResumoDaRodada = {
  casos: number
  conteudoDeve: number
  conteudoNaoPode: number
  trajetoriaCorreta: number
  chamadasDesnecessarias: number
  validaNa1a: number
  comViolacao: number
  corrigiuAposViolacao: number
  explicacaoCompleta: number
  comExplicacao: number
  explicacaoNaoAvaliada: number
  uso: Record<string, UsoDoPapel>
  trocas: number
  latenciaP50: number
  latenciaP95: number
  modelos: string[]
}

function somarUso(casos: ResultadoDoCaso[]): Record<string, UsoDoPapel> {
  const total: Record<string, UsoDoPapel> = {}
  for (const c of casos) {
    for (const [papel, u] of Object.entries(c.uso)) {
      const atual = total[papel] ?? { chamadas: 0, tokens_entrada: 0, tokens_saida: 0 }
      total[papel] = {
        chamadas: atual.chamadas + u.chamadas,
        tokens_entrada: atual.tokens_entrada + u.tokens_entrada,
        tokens_saida: atual.tokens_saida + u.tokens_saida,
      }
    }
  }
  return total
}

export function resumir(casos: ResultadoDoCaso[]): ResumoDaRodada {
  const latencias = casos.filter((c) => !c.erro).map((c) => c.latenciaMs)
  const semErro = casos.filter((c) => !c.erro)
  const comExplicacao = casos.filter((c) => c.explicacao)
  return {
    casos: casos.length,
    conteudoDeve: semErro.filter((c) => todosOk(c.deve)).length,
    conteudoNaoPode: semErro.filter((c) => todosOk(c.naoPode)).length,
    trajetoriaCorreta: casos.filter((c) => c.trajetoriaOk).length,
    chamadasDesnecessarias: soma(casos.map((c) => c.chamadasDesnecessarias)),
    validaNa1a: casos.filter((c) => c.validaNa1a).length,
    comViolacao: casos.filter((c) => c.houveViolacao).length,
    corrigiuAposViolacao: casos.filter((c) => c.houveViolacao && c.corrigiuAposViolacao).length,
    explicacaoCompleta: comExplicacao.filter(
      (c) =>
        c.explicacao?.diz_o_que_o_momento_pede &&
        c.explicacao.diz_o_que_cada_item_traz &&
        c.explicacao.texto_bate_com_sugestoes,
    ).length,
    comExplicacao: comExplicacao.length,
    explicacaoNaoAvaliada: casos.filter((c) => c.explicacaoNaoAvaliada).length,
    uso: somarUso(casos),
    trocas: soma(casos.map((c) => c.trocas)),
    latenciaP50: percentil(latencias, 50),
    latenciaP95: percentil(latencias, 95),
    modelos: [...new Set(casos.flatMap((c) => c.modelos))].sort(),
  }
}

const sim = (ok: boolean): string => (ok ? "sim" : "não")

function tabelaDeMetricas(r: ResumoDaRodada): string[] {
  const media = r.casos === 0 ? "0" : (r.chamadasDesnecessarias / r.casos).toFixed(2)
  return [
    "| Métrica | Resultado |",
    "|---|---|",
    `| Conteúdo: deve incluir | ${r.conteudoDeve}/${r.casos} (${porcentagem(r.conteudoDeve, r.casos)}) |`,
    `| Conteúdo: não pode incluir | ${r.conteudoNaoPode}/${r.casos} (${porcentagem(r.conteudoNaoPode, r.casos)}) |`,
    `| Trajetória correta | ${r.trajetoriaCorreta}/${r.casos} (${porcentagem(r.trajetoriaCorreta, r.casos)}) |`,
    `| Chamadas desnecessárias por run | ${media} (${r.chamadasDesnecessarias} no total) |`,
    `| Válida na 1ª tentativa | ${r.validaNa1a}/${r.casos} (${porcentagem(r.validaNa1a, r.casos)}) |`,
    `| Corrigiu após violação | ${r.corrigiuAposViolacao}/${r.comViolacao} (${porcentagem(r.corrigiuAposViolacao, r.comViolacao)}) |`,
    `| Explicação (as três respostas sim) | ${r.explicacaoCompleta}/${r.comExplicacao} (${porcentagem(r.explicacaoCompleta, r.comExplicacao)})${r.explicacaoNaoAvaliada > 0 ? `, ${r.explicacaoNaoAvaliada} não avaliada(s), fora da conta` : ""} |`,
    `| Trocas de modelo | ${r.trocas} |`,
    `| Latência por run (p50 / p95) | ${r.latenciaP50} ms / ${r.latenciaP95} ms |`,
  ]
}

function tabelaDeCusto(uso: Record<string, UsoDoPapel>): string[] {
  const linhas = Object.entries(uso)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([papel, u]) => `| ${papel} | ${u.chamadas} | ${u.tokens_entrada} | ${u.tokens_saida} |`)
  return [
    "| Papel | Chamadas | Tokens de entrada | Tokens de saída |",
    "|---|---|---|---|",
    ...linhas,
  ]
}

function linhaDoCaso(c: ResultadoDoCaso): string {
  if (c.erro) return `| ${c.id} | erro: ${c.erro} | erro | não | não | n/d | n/d |`
  const deve = c.deve.filter((x) => x.ok).length
  const nao = c.naoPode.filter((x) => x.ok).length
  const expl = c.explicacao
    ? sim(Object.values(c.explicacao).every(Boolean))
    : c.explicacaoNaoAvaliada
      ? "não avaliada"
      : "n/d"
  return `| ${c.id} | ${deve}/${c.deve.length} | ${nao}/${c.naoPode.length} | ${sim(c.trajetoriaOk)} | ${sim(c.validaNa1a)} | ${expl} | ${c.latenciaMs} ms |`
}

function falhasDoCaso(c: ResultadoDoCaso): string[] {
  if (c.erro) return [`- ${c.id}: erro inesperado (${c.erro})`]
  const falhas = [
    ...c.deve.filter((x) => !x.ok).map((x) => `deve: ${x.descricao}`),
    ...c.naoPode.filter((x) => !x.ok).map((x) => `não pode: ${x.descricao}`),
    ...(c.trajetoriaOk ? [] : ["trajetória fora do esperado"]),
    ...(c.explicacao && !Object.values(c.explicacao).every(Boolean)
      ? ["explicação incompleta"]
      : []),
  ]
  return falhas.map((f) => `- ${c.id}: ${f}`)
}

export function formatarRelatorio(rodada: Rodada): string {
  const r = resumir(rodada.casos)
  const falhas = rodada.casos.flatMap(falhasDoCaso)
  const linhas = [
    `# Eval com LLM: ${rodada.checkpoint}`,
    "",
    `- Versão do prompt: ${rodada.promptVersao}`,
    `- Modelos usados: ${r.modelos.length > 0 ? r.modelos.join(", ") : "nenhum"}`,
    `- Casos rodados: ${rodada.casos.length} de ${rodada.totalDeCasos}`,
  ]
  if (rodada.interrompidaPor) linhas.push(`- Rodada interrompida: ${rodada.interrompidaPor}`)
  linhas.push("", "## Métricas", "", ...tabelaDeMetricas(r))
  linhas.push("", "## Custo por papel", "", ...tabelaDeCusto(r.uso))
  linhas.push(
    "",
    "## Casos",
    "",
    "| Caso | Deve | Não pode | Trajetória | Válida na 1ª | Explicação | Latência |",
    "|---|---|---|---|---|---|---|",
    ...rodada.casos.map(linhaDoCaso),
  )
  linhas.push("", "## Falhas", "", ...(falhas.length > 0 ? falhas : ["Nenhuma."]))
  return `${linhas.join("\n")}\n`
}
