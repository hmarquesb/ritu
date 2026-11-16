// Comando do eval com LLM (spec 014): rodada de um checkpoint, retomada, do zero, extra, um caso e listagem.
// Sem container e sem disco: leitura, escrita, relógio, pausa e rodador entram pelo `io`, para os testes rodarem com fakes.
import { parseArgs } from "node:util"
import { evals } from "../../../config/evals"
import type { llmCotas } from "../../../config/llm-cotas"
import { type CasoDeEval, casosDoCheckpoint, type NomeDoCheckpoint } from "../../../evals/llm/casos"
import { TITULO_DA_FAMILIA } from "../../../evals/llm/tipos"
import type { Clock } from "../../../src/core/clock"
import { diaDaCota } from "../../../src/core/llm/janelas"
import { type Andamento, arquivoDoAndamento, assinar, lerAndamento } from "./andamento"
import { ehCheckpoint, formatarListagem, nomesDeCheckpoint } from "./casos"
import { gerarComparacao } from "./comparacao"
import { cabecalhoDasFalhas, formatarFalha } from "./falhas-locais"
import {
  anteriorA,
  entradaDaRodada,
  formatarHistorico,
  lerHistorico,
  trocarEntrada,
} from "./historico"
import { avaliarMetas } from "./metas"
import { calcularMetricas } from "./metricas"
import { formatarRelatorio } from "./relatorio"
import { codigoDoErro, type ResultadoDoCaso, type UsoDoPapel } from "./resultado"
import { ehParada, executarRodada, type FimDaRodada } from "./rodada"
import type { CasoRodado } from "./rodar-run"

export type IoDoComando = {
  ler(caminho: string): Promise<string | undefined> // undefined se não existe
  gravar(caminho: string, texto: string): Promise<void> // cria a pasta
  anexar(caminho: string, texto: string): Promise<void>
  apagar(caminho: string): Promise<void> // sem erro se não existe
  log(linha: string): void
  erro(linha: string): void
  clock: Clock
  esperar(ms: number): Promise<void>
  prompts: Record<string, string> // acompanhante, interprete, memoria, juiz, avaliador → versão
  papeis: typeof llmCotas.papeis
  rodarCaso(caso: CasoDeEval): Promise<CasoRodado> // já com o avaliador (criarRodarCaso)
}

const HISTORICO = "evals/resultados/historico.json"
const COMPARACAO = "evals/COMPARACAO.md"
const relatorioDo = (checkpoint: string): string => `evals/resultados/${checkpoint}.md`
const jsonDo = (checkpoint: string): string => `evals/resultados/${checkpoint}.json`
const falhasDo = (checkpoint: string): string => `evals/local/${checkpoint}-falhas.md`

const USO =
  "Opções: --checkpoint <nome> com um de --retomar, --do-zero, --extra, --caso <id> ou --listar (ou sem nenhum, para rodada nova)."
const HISTORICO_INVALIDO = `${HISTORICO} está inválido: não será sobrescrito. Corrija ou apague o arquivo.`

type Opcoes = {
  checkpoint: NomeDoCheckpoint
  listar: boolean
  retomar: boolean
  doZero: boolean
  extra: boolean
  caso?: string
}

type LeituraDeOpcoes = { ok: true; opcoes: Opcoes } | { ok: false; mensagem: string }

function lerOpcoes(args: string[]): LeituraDeOpcoes {
  let valores: {
    checkpoint?: string
    listar?: boolean
    retomar?: boolean
    "do-zero"?: boolean
    extra?: boolean
    caso?: string
  }
  try {
    valores = parseArgs({
      args,
      options: {
        checkpoint: { type: "string" },
        listar: { type: "boolean" },
        retomar: { type: "boolean" },
        "do-zero": { type: "boolean" },
        extra: { type: "boolean" },
        caso: { type: "string" },
      },
      strict: true,
    }).values
  } catch (erro) {
    return {
      ok: false,
      mensagem: `${erro instanceof Error ? erro.message : "Argumento inválido"}. ${USO}`,
    }
  }
  const nome = valores.checkpoint
  if (nome === undefined || !ehCheckpoint(nome)) {
    return {
      ok: false,
      mensagem: `Informe --checkpoint com um de: ${nomesDeCheckpoint().join(", ")}.`,
    }
  }
  return {
    ok: true,
    opcoes: {
      checkpoint: nome,
      listar: valores.listar === true,
      retomar: valores.retomar === true,
      doZero: valores["do-zero"] === true,
      extra: valores.extra === true,
      caso: valores.caso,
    },
  }
}

/** Combinações que não fazem sentido: a mensagem diz o que trocar. `undefined` quando a combinação é válida. */
function combinacaoInvalida(o: Opcoes): string | undefined {
  if (o.retomar && o.doZero) return "--retomar e --do-zero não combinam."
  if (o.caso !== undefined && (o.listar || o.retomar || o.doZero || o.extra)) {
    return "--caso roda um caso sem gravar nada: não combina com --listar, --retomar, --do-zero nem --extra."
  }
  if (o.listar && (o.retomar || o.doZero || o.extra)) {
    return "--listar não combina com --retomar, --do-zero nem --extra."
  }
  if (o.extra && o.retomar) return "--extra só vale para rodada nova ou --do-zero."
  return undefined
}

const situacaoDaChecagem = (ok: boolean | null): string => {
  if (ok === true) return "ok"
  return ok === false ? "falhou" : "não avaliada"
}

const linhaDaChecagem = (c: ResultadoDoCaso["checagens"][number]): string =>
  `- ${c.lista}: ${c.descricao} · ${situacaoDaChecagem(c.ok)}`

function linhasDoCusto(r: ResultadoDoCaso): string[] {
  const papeis = Object.entries(r.uso).map(
    ([papel, uso]) => `- ${papel}: ${linhaDeUso(uso as UsoDoPapel)}`,
  )
  const avaliador = r.usoDoAvaliador ? [`- avaliador: ${linhaDeUso(r.usoDoAvaliador)}`] : []
  return [...papeis, ...avaliador]
}

function linhaDeUso(uso: UsoDoPapel): string {
  return `${uso.chamadas} chamadas, ${uso.tokens_entrada} tokens de entrada, ${uso.tokens_saida} de saída`
}

function linhasDoCaso(rodado: CasoRodado): string[] {
  const r = rodado.resultado
  const familias = r.familias.map((f) => TITULO_DA_FAMILIA[f]).join(", ") || "—"
  const checagens = r.checagens.length === 0 ? ["- nenhuma"] : r.checagens.map(linhaDaChecagem)
  const etapas =
    rodado.colhido.etapas.length === 0
      ? ["- nenhuma"]
      : rodado.colhido.etapas.map(
          (e, posicao) =>
            `${posicao + 1}. ${e.tipo} · ${e.nome} · ${e.status} · ${e.resumo ?? "—"}`,
        )
  const custo = linhasDoCusto(r)
  return [
    `${r.id} · ${r.titulo}`,
    `Tipo: ${r.tipo}. Famílias: ${familias}.`,
    `Resultado: ${r.acertou ? "acertou" : "errado"}.`,
    "Checagens:",
    ...checagens,
    "Etapas:",
    ...etapas,
    "Custo:",
    ...(custo.length === 0 ? ["- nenhum"] : custo),
    `Trocas de modelo: ${r.trocas}. Latência: ${r.latenciaMs} ms. Modelos: ${r.modelos.join(", ") || "—"}.`,
  ]
}

/** `--caso`: roda um caso e imprime; não grava arquivo nem andamento. */
async function rodarUmCaso(caso: CasoDeEval, io: IoDoComando): Promise<number> {
  let rodado: CasoRodado
  try {
    rodado = await io.rodarCaso(caso)
  } catch (erro) {
    if (ehParada(erro)) {
      io.erro("sem modelo")
      return 2
    }
    io.erro(`Erro no caso: ${codigoDoErro(erro)}`)
    return 1
  }
  for (const linha of linhasDoCaso(rodado)) io.log(linha)
  return 0
}

type Partida = { ok: true; anterior?: Andamento } | { ok: false; mensagem: string }

/** Decide, a partir do andamento salvo, se a rodada começa ou continua. */
function partidaDoAndamento(o: Opcoes, texto: string | undefined, assinatura: string): Partida {
  const cp = o.checkpoint
  if (!o.retomar) {
    if (o.doZero || texto === undefined) return { ok: true }
    return {
      ok: false,
      mensagem: `Há andamento de ${cp}. Continue com --retomar ou comece do zero com --do-zero.`,
    }
  }
  if (texto === undefined) {
    return {
      ok: false,
      mensagem: `Sem andamento de ${cp} para retomar. Comece com --checkpoint ${cp}.`,
    }
  }
  const lido = lerAndamento(texto)
  if (!lido.ok) {
    return {
      ok: false,
      mensagem: `O andamento de ${cp} está em outra versão ou com formato inválido. Comece do zero com --do-zero.`,
    }
  }
  if (lido.andamento.assinatura !== assinatura) {
    return {
      ok: false,
      mensagem: `Os casos, os prompts ou os modelos mudaram desde o andamento de ${cp}. Comece do zero com --do-zero.`,
    }
  }
  return { ok: true, anterior: lido.andamento }
}

/** Rodada nova e `--do-zero` recusam quando já houve rodada completa hoje (D18). Histórico inválido recusa sempre. */
async function recusaDoDia(o: Opcoes, hoje: string, io: IoDoComando): Promise<string | undefined> {
  const lido = lerHistorico(await io.ler(HISTORICO))
  if (!lido.ok) return HISTORICO_INVALIDO
  const houveHoje = lido.historico.checkpoints.some((entrada) => entrada.data === hoje)
  if (o.extra || !houveHoje) return undefined
  return `Já há uma rodada completa de hoje (${hoje}). Use --extra para rodar outra.`
}

const formatarAndamento = (a: Andamento): string => `${JSON.stringify(a, null, 2)}\n`

/** Caso que roda pelo `io`: falha do caso vai para o arquivo local de falhas, na hora. */
function anotarFalhas(
  io: IoDoComando,
  caminho: string,
): (caso: CasoDeEval) => Promise<ResultadoDoCaso> {
  return async (caso) => {
    let rodado: CasoRodado
    try {
      rodado = await io.rodarCaso(caso)
    } catch (erro) {
      if (!ehParada(erro)) {
        await io.anexar(
          caminho,
          `## ${caso.id} · ${caso.titulo}\n\nErro: ${codigoDoErro(erro)}\n\n`,
        )
      }
      throw erro
    }
    if (!rodado.resultado.acertou) {
      await io.anexar(caminho, formatarFalha(rodado.resultado, rodado.colhido))
    }
    return rodado.resultado
  }
}

async function interrompida(
  o: Opcoes,
  fim: FimDaRodada,
  total: number,
  io: IoDoComando,
): Promise<number> {
  await io.gravar(arquivoDoAndamento(o.checkpoint), formatarAndamento(fim.andamento))
  const feitos = fim.andamento.resultados.filter((r) => r.erro === undefined).length
  io.erro(
    `Rodada interrompida no caso ${fim.parouEm ?? "—"} (${fim.motivo}). ${feitos} de ${total} feitos. Continue com: npm run eval:llm -- --checkpoint ${o.checkpoint} --retomar`,
  )
  return 2
}

/** Rodada completa: relatório, JSON, histórico e comparação; só então apaga o andamento. */
async function concluir(
  o: Opcoes,
  total: number,
  fim: FimDaRodada,
  io: IoDoComando,
): Promise<number> {
  const cp = o.checkpoint
  const data = diaDaCota(io.clock.now())
  const resultados = fim.andamento.resultados
  const metricas = calcularMetricas(resultados)
  const avaliacao = avaliarMetas(metricas, evals.metas)
  const lido = lerHistorico(await io.ler(HISTORICO))
  if (!lido.ok) {
    io.erro(HISTORICO_INVALIDO)
    return 1
  }
  const entrada = entradaDaRodada({
    checkpoint: cp,
    data,
    prompts: io.prompts,
    resultados,
    metas: evals.metas,
  })
  const novo = trocarEntrada(lido.historico, entrada)
  try {
    await io.gravar(
      relatorioDo(cp),
      formatarRelatorio({
        checkpoint: cp,
        data,
        prompts: io.prompts,
        modelos: entrada.modelos,
        resultados,
        totalDeCasos: total,
        metricas,
        avaliacao,
        metas: evals.metas,
        anterior: anteriorA(lido.historico, cp),
      }),
    )
    await io.gravar(
      jsonDo(cp),
      `${JSON.stringify({ checkpoint: cp, data, assinatura: fim.andamento.assinatura, prompts: io.prompts, modelos: entrada.modelos, resultados }, null, 2)}\n`,
    )
    await io.gravar(HISTORICO, formatarHistorico(novo))
    await io.gravar(COMPARACAO, gerarComparacao(novo))
  } catch (erro) {
    io.erro(
      `Falha ao gravar os resultados de ${cp} (${codigoDoErro(erro)}). O andamento ficou: rode de novo com --retomar.`,
    )
    return 1
  }
  await io.apagar(arquivoDoAndamento(cp))
  io.log(`Relatório gravado em ${relatorioDo(cp)}`)
  return 0
}

async function rodarCheckpoint(o: Opcoes, casos: CasoDeEval[], io: IoDoComando): Promise<number> {
  const cp = o.checkpoint
  const assinatura = assinar({
    ids: casos.map((c) => c.id),
    prompts: io.prompts,
    papeis: io.papeis,
  })
  const caminho = arquivoDoAndamento(cp)
  const partida = partidaDoAndamento(o, await io.ler(caminho), assinatura)
  if (!partida.ok) {
    io.erro(partida.mensagem)
    return 1
  }
  if (!o.retomar) {
    const hoje = diaDaCota(io.clock.now())
    const recusa = await recusaDoDia(o, hoje, io)
    if (recusa !== undefined) {
      io.erro(recusa)
      return 1
    }
    await io.apagar(caminho)
    await io.gravar(falhasDo(cp), cabecalhoDasFalhas(cp, hoje))
  }
  const fim = await executarRodada({
    checkpoint: cp,
    casos,
    assinatura,
    anterior: partida.anterior,
    rodarCaso: anotarFalhas(io, falhasDo(cp)),
    salvar: (a) => io.gravar(caminho, formatarAndamento(a)),
    esperar: (ms) => io.esperar(ms),
    clock: io.clock,
    log: (linha) => io.log(linha),
  })
  if (fim.fim === "interrompida") return interrompida(o, fim, casos.length, io)
  return concluir(o, casos.length, fim, io)
}

/** Roda o comando e devolve o código de saída: 0 ok, 1 uso, recusa ou erro, 2 interrompida (ou `--caso` sem modelo). */
export async function executarComando(args: string[], io: IoDoComando): Promise<number> {
  try {
    const lido = lerOpcoes(args)
    if (!lido.ok) {
      io.erro(lido.mensagem)
      return 1
    }
    const o = lido.opcoes
    const invalida = combinacaoInvalida(o)
    if (invalida !== undefined) {
      io.erro(invalida)
      return 1
    }
    const casos = casosDoCheckpoint(o.checkpoint)
    if (o.caso !== undefined) {
      const caso = casos.find((c) => c.id === o.caso)
      if (caso === undefined) {
        io.erro(
          `Caso ${o.caso} não existe em ${o.checkpoint}. Ids: ${casos.map((c) => c.id).join(", ")}.`,
        )
        return 1
      }
      return rodarUmCaso(caso, io)
    }
    if (o.listar) {
      io.log(formatarListagem(o.checkpoint))
      return 0
    }
    return rodarCheckpoint(o, casos, io)
  } catch (erro) {
    io.erro(`Falha no eval: ${codigoDoErro(erro)}.`)
    return 1
  }
}
