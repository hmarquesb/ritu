// Relatório do eval com LLM: funções puras que somam os resultados de uma rodada e formatam o Markdown.

export type ChecagemDeExpectativa = { descricao: string; ok: boolean }

export type Explicacao = {
  diz_o_que_o_momento_pede: boolean
  diz_o_que_cada_item_traz: boolean
  texto_bate_com_sugestoes: boolean
}

export type UsoDoPapel = { chamadas: number; tokens_entrada: number; tokens_saida: number }

// Ausente = acompanhante. O Intérprete não tem trajetória nem validação: só entra na seção Intenção.
// A Memória tem resumo, não run: entra nas métricas de resposta e na seção Memória. O Juiz também: uma leitura sobre uma resposta pronta.
export type TipoDoCaso = "acompanhante" | "interprete" | "conversa" | "memoria" | "juiz"

export type ResultadoDoCaso = {
  id: string
  titulo: string
  tipo?: TipoDoCaso
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
  /** Caso interprete com falsoAlerta: true. */
  falsoAlerta?: boolean
  /** A interpretação veio com alerta. */
  alertou?: boolean
  /** Códigos de violação da primeira validação (acompanhante e conversa). */
  violacoesDaPrimeira?: string[]
  /** Caso conversa de pergunta: se o run devia perguntar ou não. Ausente = sem seção Perguntas. */
  pergunta?: "necessaria" | "desnecessaria"
  /** Tipos das perguntas que saíram no run (casa, come, variante). */
  perguntas?: string[]
  /** Etapas ask_user recusadas pelo código no run. */
  recusadas?: number
  /** Caso conversa de proposta: se o run devia propor no bloco (esperada) ou não propor (nenhuma). Ausente = sem seção Propostas. */
  proposta?: "esperada" | "nenhuma"
  /** Propostas da saída do run (o bloco). Ausente quando o run não chegou a uma saída. */
  propostas?: number
  /** Chamadas de tool de proposta recusadas pelo código no run. */
  propostasRecusadas?: number
  /** Status do run lido depois do bloco: waiting_for_approval quando o runner não decidiu o bloco. */
  statusDoRun?: string
  /** Família do caso (D14, D22): cada família tem a sua seção. Ausente = fora das seções de família. */
  familia?:
    | "aprendizado"
    | "para_ter"
    | "memoria"
    | "seguranca"
    | "linguagem"
    | "incomodos"
    | "juiz"
  /** Caso juiz: os motivos que o caso espera ver apontados. */
  motivosEsperados?: string[]
  /** Caso juiz: os motivos apontados (graves e registros), sem repetir. */
  motivosApontados?: string[]
  /** Caso juiz: resposta boa; conta para as falsas reprovações. */
  boa?: boolean
  /** Veredito do Juiz: no run da conversa (lido dos resumos das etapas) ou na leitura do caso juiz. */
  juiz?: { tentativas: number; aprovado: boolean | null; motivos: string[] }
  /** Caso memoria: se o resumo veio do modelo ou caiu no código (sem modelo, erro ou resumo inválido). */
  origem?: "modelo" | "codigo"
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

const ehInterprete = (c: ResultadoDoCaso): boolean => c.tipo === "interprete"
const respostasDe = (casos: ResultadoDoCaso[]): ResultadoDoCaso[] =>
  casos.filter((c) => !ehInterprete(c))
const interpretesDe = (casos: ResultadoDoCaso[]): ResultadoDoCaso[] => casos.filter(ehInterprete)

const intencaoOk = (c: ResultadoDoCaso): boolean => !c.erro && todosOk(c.deve) && todosOk(c.naoPode)

export type ResumoDoInterprete = {
  casos: number
  intencao: number
  falsosAlertas: number
  marcadosFalsoAlerta: number
  chamadas: number
  tokensEntrada: number
  tokensSaida: number
  latenciaP50: number
  latenciaP95: number
}

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
  violacoes: Record<string, number>
  interprete: ResumoDoInterprete
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

function violacoesPorCodigo(respostas: ResultadoDoCaso[]): Record<string, number> {
  const total: Record<string, number> = {}
  for (const c of respostas) {
    for (const codigo of c.violacoesDaPrimeira ?? []) {
      total[codigo] = (total[codigo] ?? 0) + 1
    }
  }
  return total
}

function resumoDoInterprete(casos: ResultadoDoCaso[]): ResumoDoInterprete {
  const lista = interpretesDe(casos)
  const latencias = lista.filter((c) => !c.erro).map((c) => c.latenciaMs)
  const apoio = somarUso(lista).apoio ?? { chamadas: 0, tokens_entrada: 0, tokens_saida: 0 }
  return {
    casos: lista.length,
    intencao: lista.filter(intencaoOk).length,
    falsosAlertas: lista.filter((c) => c.falsoAlerta && c.alertou).length,
    marcadosFalsoAlerta: lista.filter((c) => c.falsoAlerta).length,
    chamadas: apoio.chamadas,
    tokensEntrada: apoio.tokens_entrada,
    tokensSaida: apoio.tokens_saida,
    latenciaP50: percentil(latencias, 50),
    latenciaP95: percentil(latencias, 95),
  }
}

export function resumir(casos: ResultadoDoCaso[]): ResumoDaRodada {
  const respostas = respostasDe(casos)
  const latencias = respostas.filter((c) => !c.erro).map((c) => c.latenciaMs)
  const semErro = respostas.filter((c) => !c.erro)
  const comExplicacao = respostas.filter((c) => c.explicacao)
  return {
    casos: respostas.length,
    conteudoDeve: semErro.filter((c) => todosOk(c.deve)).length,
    conteudoNaoPode: semErro.filter((c) => todosOk(c.naoPode)).length,
    trajetoriaCorreta: respostas.filter((c) => c.trajetoriaOk).length,
    chamadasDesnecessarias: soma(respostas.map((c) => c.chamadasDesnecessarias)),
    validaNa1a: respostas.filter((c) => c.validaNa1a).length,
    comViolacao: respostas.filter((c) => c.houveViolacao).length,
    corrigiuAposViolacao: respostas.filter((c) => c.houveViolacao && c.corrigiuAposViolacao).length,
    explicacaoCompleta: comExplicacao.filter(
      (c) =>
        c.explicacao?.diz_o_que_o_momento_pede &&
        c.explicacao.diz_o_que_cada_item_traz &&
        c.explicacao.texto_bate_com_sugestoes,
    ).length,
    comExplicacao: comExplicacao.length,
    explicacaoNaoAvaliada: respostas.filter((c) => c.explicacaoNaoAvaliada).length,
    violacoes: violacoesPorCodigo(respostas),
    interprete: resumoDoInterprete(casos),
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

function tabelaDeViolacoes(violacoes: Record<string, number>): string[] {
  const linhas = Object.entries(violacoes)
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([codigo, n]) => `| ${codigo} | ${n} |`)
  return linhas.length > 0 ? ["| Código | Casos |", "|---|---|", ...linhas] : ["Nenhuma."]
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

function tabelaDeIntencao(casos: ResultadoDoCaso[]): string[] {
  const linhas = interpretesDe(casos).map((c) => {
    if (c.erro) return `| ${c.id} | erro: ${c.erro} | erro | não | ${c.latenciaMs} ms |`
    const deve = c.deve.filter((x) => x.ok).length
    const nao = c.naoPode.filter((x) => x.ok).length
    return `| ${c.id} | ${deve}/${c.deve.length} | ${nao}/${c.naoPode.length} | ${sim(intencaoOk(c))} | ${c.latenciaMs} ms |`
  })
  return ["| Caso | Deve | Não pode | Intenção | Latência |", "|---|---|---|---|---|", ...linhas]
}

function secaoDoInterprete(casos: ResultadoDoCaso[], i: ResumoDoInterprete): string[] {
  const linhas = [
    "## Intenção",
    "",
    ...tabelaDeIntencao(casos),
    "",
    `- Intenção: ${i.intencao}/${i.casos} (${porcentagem(i.intencao, i.casos)})`,
  ]
  if (i.marcadosFalsoAlerta > 0) {
    linhas.push(`- Falsos alertas: ${i.falsosAlertas} de ${i.marcadosFalsoAlerta} casos marcados`)
  }
  linhas.push(
    "",
    "### Custo do papel apoio",
    "",
    "| Chamadas | Tokens de entrada | Tokens de saída | Latência p50 | Latência p95 |",
    "|---|---|---|---|---|",
    `| ${i.chamadas} | ${i.tokensEntrada} | ${i.tokensSaida} | ${i.latenciaP50} ms | ${i.latenciaP95} ms |`,
  )
  return linhas
}

const comPergunta = (casos: ResultadoDoCaso[]): ResultadoDoCaso[] =>
  casos.filter((c) => c.pergunta !== undefined)

// Acerto de uma pergunta: a necessária tem ao menos uma de casa; a desnecessária não tem nenhuma.
function acertouAPergunta(c: ResultadoDoCaso): boolean {
  const feitas = c.perguntas ?? []
  return c.pergunta === "necessaria" ? feitas.includes("casa") : feitas.length === 0
}

export type ResumoDePerguntas = {
  necessarias: number
  necessariasFeitas: number
  desnecessarias: number
  desnecessariasEvitadas: number
  recusadas: number
  runs: number
}

export function resumirPerguntas(casos: ResultadoDoCaso[]): ResumoDePerguntas {
  const marcados = comPergunta(casos)
  const necessarias = marcados.filter((c) => c.pergunta === "necessaria")
  const desnecessarias = marcados.filter((c) => c.pergunta === "desnecessaria")
  const runs = casos.filter((c) => c.tipo === "conversa" && c.recusadas !== undefined)
  return {
    necessarias: necessarias.length,
    necessariasFeitas: necessarias.filter(acertouAPergunta).length,
    desnecessarias: desnecessarias.length,
    desnecessariasEvitadas: desnecessarias.filter(acertouAPergunta).length,
    recusadas: soma(runs.map((c) => c.recusadas ?? 0)),
    runs: runs.length,
  }
}

export type ResumoDePropostas = {
  casos: number
  corretas: number
  recusadas: number
  runs: number
}

// Acerto de uma proposta: a esperada tem ao menos uma e todos os deve; a nenhuma não tem nenhuma. Erro não acerta.
function acertouAProposta(c: ResultadoDoCaso): boolean {
  if (c.erro || c.propostas === undefined) return false
  if (c.proposta === "esperada") return c.propostas > 0 && todosOk(c.deve)
  return c.propostas === 0
}

function comProposta(casos: ResultadoDoCaso[]): ResultadoDoCaso[] {
  return casos.filter((c) => c.proposta !== undefined)
}

export function resumirPropostas(casos: ResultadoDoCaso[]): ResumoDePropostas {
  const marcados = comProposta(casos)
  const runs = casos.filter((c) => c.tipo === "conversa" && c.propostasRecusadas !== undefined)
  return {
    casos: marcados.length,
    corretas: marcados.filter(acertouAProposta).length,
    recusadas: soma(runs.map((c) => c.propostasRecusadas ?? 0)),
    runs: runs.length,
  }
}

function linhaDeProposta(c: ResultadoDoCaso): string {
  const quantas = c.erro ? `erro: ${c.erro}` : String(c.propostas ?? "n/d")
  return `| ${c.id} | ${c.proposta} | ${quantas} | ${sim(acertouAProposta(c))} |`
}

function secaoDePropostas(casos: ResultadoDoCaso[]): string[] {
  const r = resumirPropostas(casos)
  const media = r.runs === 0 ? "0" : (r.recusadas / r.runs).toFixed(2)
  return [
    "## Propostas",
    "",
    "| Caso | Esperada | Propostas | Acertou |",
    "|---|---|---|---|",
    ...comProposta(casos).map(linhaDeProposta),
    "",
    `- Propostas corretas: ${r.corretas}/${r.casos} (${porcentagem(r.corretas, r.casos)})`,
    `- Propostas recusadas pelo código por run: ${media} (${r.recusadas} no total, em ${r.runs} runs)`,
  ]
}

// Acerto de uma família: sem erro, todos os deve ok e todos os naoPode ok (naoPode ok = o que não podia acontecer não aconteceu).
const acertouNaFamilia = (c: ResultadoDoCaso): boolean =>
  !c.erro && todosOk(c.deve) && todosOk(c.naoPode)

const daFamilia = (casos: ResultadoDoCaso[], familia: string): ResultadoDoCaso[] =>
  casos.filter((c) => c.familia === familia)

// Seção de uma família: acerto por caso e total; `detalhes` acrescenta as medidas específicas da família.
function secaoDeFamilia(
  titulo: string,
  familia: string,
  casos: ResultadoDoCaso[],
  detalhes: (lista: ResultadoDoCaso[]) => string[] = () => [],
): string[] {
  const lista = daFamilia(casos, familia)
  const acertos = lista.filter(acertouNaFamilia).length
  return [
    `## ${titulo}`,
    "",
    "| Caso | Acertou |",
    "|---|---|",
    ...lista.map((c) => `| ${c.id} | ${sim(acertouNaFamilia(c))} |`),
    "",
    `- Acerto: ${acertos}/${lista.length} (${porcentagem(acertos, lista.length)})`,
    ...detalhes(lista),
  ]
}

const motivosEsperadosDe = (lista: ResultadoDoCaso[]): string[] => [
  ...new Set(lista.flatMap((c) => c.motivosEsperados ?? [])),
]

// Para cada motivo esperado em algum caso: em quantos desses casos o Juiz o apontou.
function linhasDeMotivo(lista: ResultadoDoCaso[]): string[] {
  const linhas = motivosEsperadosDe(lista).map((motivo) => {
    const esperados = lista.filter((c) => c.motivosEsperados?.includes(motivo))
    const apontados = esperados.filter((c) => c.motivosApontados?.includes(motivo)).length
    return `- ${motivo}: apontada em ${apontados} de ${esperados.length} casos`
  })
  return linhas.length > 0 ? linhas : ["- Nenhum motivo esperado."]
}

function detalhesDoJuiz(lista: ResultadoDoCaso[]): string[] {
  const boas = lista.filter((c) => c.boa)
  const reprovadas = boas.filter((c) => c.juiz?.aprovado === false).length
  return [
    "",
    "### Acerto por motivo",
    "",
    ...linhasDeMotivo(lista),
    "",
    `- Falsas reprovações: ${reprovadas} de ${boas.length}`,
  ]
}

function detalhesDeLinguagem(lista: ResultadoDoCaso[]): string[] {
  const marcados = lista.filter((c) => c.falsoAlerta)
  return [`- Falsos alertas: ${marcados.filter((c) => c.alertou).length} de ${marcados.length}`]
}

function detalhesDeIncomodos(lista: ResultadoDoCaso[]): string[] {
  const bloqueadas = lista.filter((c) => c.juiz?.motivos.includes("promessa")).length
  return [`- Promessas bloqueadas: ${bloqueadas}`]
}

function linhaDePergunta(c: ResultadoDoCaso): string {
  const rotulo = c.pergunta === "necessaria" ? "necessária" : "desnecessária"
  const feitas = (c.perguntas ?? []).join(", ") || "nenhuma"
  return `| ${c.id} | ${rotulo} | ${feitas} | ${sim(acertouAPergunta(c))} |`
}

function secaoDePerguntas(casos: ResultadoDoCaso[]): string[] {
  const r = resumirPerguntas(casos)
  const media = r.runs === 0 ? "0" : (r.recusadas / r.runs).toFixed(2)
  return [
    "## Perguntas",
    "",
    "| Caso | Esperada | Perguntas feitas | Acertou |",
    "|---|---|---|---|",
    ...comPergunta(casos).map(linhaDePergunta),
    "",
    `- Perguntas necessárias feitas: ${r.necessariasFeitas}/${r.necessarias} (${porcentagem(r.necessariasFeitas, r.necessarias)})`,
    `- Desnecessárias evitadas: ${r.desnecessariasEvitadas}/${r.desnecessarias} (${porcentagem(r.desnecessariasEvitadas, r.desnecessarias)})`,
    `- Perguntas recusadas pelo código por run: ${media} (${r.recusadas} no total, em ${r.runs} runs)`,
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

function cabecalho(rodada: Rodada, r: ResumoDaRodada): string[] {
  const linhas = [
    `# Eval com LLM: ${rodada.checkpoint}`,
    "",
    `- Versão do prompt: ${rodada.promptVersao}`,
    `- Modelos usados: ${r.modelos.length > 0 ? r.modelos.join(", ") : "nenhum"}`,
    `- Casos rodados: ${rodada.casos.length} de ${rodada.totalDeCasos}`,
  ]
  if (rodada.interrompidaPor) linhas.push(`- Rodada interrompida: ${rodada.interrompidaPor}`)
  return linhas
}

function secaoDeRespostas(r: ResumoDaRodada): string[] {
  return [
    "",
    "## Métricas",
    "",
    ...tabelaDeMetricas(r),
    "",
    "## Violações da 1ª entrega",
    "",
    ...tabelaDeViolacoes(r.violacoes),
  ]
}

function secaoDeCasos(casos: ResultadoDoCaso[]): string[] {
  return [
    "",
    "## Casos",
    "",
    "| Caso | Deve | Não pode | Trajetória | Válida na 1ª | Explicação | Latência |",
    "|---|---|---|---|---|---|---|",
    ...respostasDe(casos).map(linhaDoCaso),
  ]
}

export function formatarRelatorio(rodada: Rodada): string {
  const r = resumir(rodada.casos)
  const falhas = rodada.casos.flatMap(falhasDoCaso)
  const linhas = cabecalho(rodada, r)
  if (r.casos > 0) linhas.push(...secaoDeRespostas(r))
  if (r.interprete.casos > 0) linhas.push("", ...secaoDoInterprete(rodada.casos, r.interprete))
  if (comPergunta(rodada.casos).length > 0) linhas.push("", ...secaoDePerguntas(rodada.casos))
  if (comProposta(rodada.casos).length > 0) linhas.push("", ...secaoDePropostas(rodada.casos))
  if (daFamilia(rodada.casos, "aprendizado").length > 0) {
    linhas.push("", ...secaoDeFamilia("Aprendizado", "aprendizado", rodada.casos))
  }
  if (daFamilia(rodada.casos, "para_ter").length > 0) {
    linhas.push("", ...secaoDeFamilia("Para ter em casa", "para_ter", rodada.casos))
  }
  if (daFamilia(rodada.casos, "memoria").length > 0) {
    linhas.push("", ...secaoDeFamilia("Memória", "memoria", rodada.casos))
  }
  if (daFamilia(rodada.casos, "juiz").length > 0) {
    linhas.push("", ...secaoDeFamilia("Juiz", "juiz", rodada.casos, detalhesDoJuiz))
  }
  if (daFamilia(rodada.casos, "seguranca").length > 0) {
    linhas.push("", ...secaoDeFamilia("Segurança", "seguranca", rodada.casos))
  }
  if (daFamilia(rodada.casos, "linguagem").length > 0) {
    linhas.push(
      "",
      ...secaoDeFamilia("Linguagem e sofrimento", "linguagem", rodada.casos, detalhesDeLinguagem),
    )
  }
  if (daFamilia(rodada.casos, "incomodos").length > 0) {
    linhas.push("", ...secaoDeFamilia("Incômodos", "incomodos", rodada.casos, detalhesDeIncomodos))
  }
  linhas.push("", "## Custo por papel", "", ...tabelaDeCusto(r.uso))
  if (r.casos > 0) linhas.push(...secaoDeCasos(rodada.casos))
  linhas.push("", "## Falhas", "", ...(falhas.length > 0 ? falhas : ["Nenhuma."]))
  return `${linhas.join("\n")}\n`
}
