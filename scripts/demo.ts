// Demonstração do Acompanhante e da conversa. Sem argumento, lista os cenários. Com --cenario, roda um deles
// com o runtime roteirizado, sem rede. Com --llm (⚠️ chama o modelo real), troca o runtime e o cliente do modelo.
// Com --interativo, lê do terminal a resposta de cada pergunta (uma linha por item de casa, ou uma por pergunta)
// e a decisão do bloco de aprovação (Enter anota tudo, números desligam linhas, n é Agora não).
// Uso: npm run demo | npm run demo -- --cenario <nome> [--esgotar decisao] [--llm] [--interativo]
import { createInterface } from "node:readline"
import { parseArgs } from "node:util"
import { config, llmCotas, type Papel } from "@config/index"
import type { RespostaDoRun } from "@/core/agents/companion/responder"
import type { RespostaDaConversa } from "@/core/conversation/conversar"
import type { EvitarItem } from "@/core/knowledge/filtros"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { textoDaMensagem } from "@/core/messages/texto"
import type { ItemDaCasa } from "@/core/pantry/types"
import type { PropostaNaSaida } from "@/core/proposals/conteudo"
import type { EventoAoVivo } from "@/core/runs/loop"
import type { Pergunta, RespostaDaPessoa } from "@/core/runs/pergunta"
import { getContainer } from "@/infra/container"
import {
  type Cenario,
  cenarios,
  cenariosComAprovacao,
  cenariosComPausa,
  cenariosDeConversa,
  type DepsDoCenario,
  montarCenario,
  type OpcoesDoCenario,
  type RodadaDoCenario,
  rodarCenario,
} from "../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../test/fixtures/cenarios/tipos"
import { type DadosDoRelatorio, formatarRelatorio, type Pensamento } from "./lib/demo-report"
import {
  aprovadasDoTexto,
  formatarBloco,
  formatarPergunta,
  respostaDoTexto,
} from "./lib/demo-resposta"

function papelValido(nome: string): nome is Papel {
  return Object.hasOwn(llmCotas.papeis, nome)
}

function listarCenarios(): void {
  console.log("Cenários:")
  const todos = [
    ...Object.values(cenarios),
    ...Object.values(cenariosDeConversa),
    ...Object.values(cenariosComPausa),
    ...Object.values(cenariosComAprovacao),
  ]
  for (const c of todos) {
    console.log(`  ${c.nome}  ${c.descricao}`)
  }
}

function acharCenario(nome: string): Cenario | CenarioDeConversa | undefined {
  if (Object.hasOwn(cenarios, nome)) return cenarios[nome]
  if (Object.hasOwn(cenariosDeConversa, nome)) return cenariosDeConversa[nome]
  if (Object.hasOwn(cenariosComPausa, nome)) return cenariosComPausa[nome]
  if (Object.hasOwn(cenariosComAprovacao, nome)) return cenariosComAprovacao[nome]
  return undefined
}

// Guarda os pensamentos de cada run. Um pensamento vem logo antes da tool que o usa, então vai para a etapa seguinte.
function coletorDePensamentos() {
  const porRun = new Map<string, Pensamento[]>()
  let pendentes: string[] = []
  return {
    pensamentosDo(runId: string): Pensamento[] {
      return porRun.get(runId) ?? []
    },
    aoVivo(e: EventoAoVivo): void {
      if (e.tipo === "pensamento") pendentes.push(e.texto)
      if (e.tipo !== "etapa_concluida") return
      const lista = porRun.get(e.etapa.run_id) ?? []
      lista.push(...pendentes.map((texto) => ({ depoisDaOrdem: e.etapa.ordem - 1, texto })))
      porRun.set(e.etapa.run_id, lista)
      pendentes = []
    },
  }
}

// Nome de quem o Evitar cita: alimento e grupo pelo nome da base; texto livre é a própria frase.
function nomeDoEvitarDaBase(kb: KnowledgeBase) {
  return (item: EvitarItem): string => {
    if (item.tipo === "alimento") return kb.alimento(item.valor)?.nome ?? item.valor
    if (item.tipo === "grupo") {
      return kb.gruposEvitar.find((g) => g.id === item.valor)?.nome ?? item.valor
    }
    return item.valor
  }
}

// Lê uma linha por vez do terminal. Ao fim da entrada (pipe que acabou), devolve vazio, que pula o item.
function leitorDoTerminal() {
  const rl = createInterface({ input: process.stdin, terminal: process.stdin.isTTY === true })
  const linhas = rl[Symbol.asyncIterator]()
  return {
    async proxima(): Promise<string> {
      const lida = await linhas.next()
      return lida.done ? "" : lida.value
    },
    fechar: (): void => rl.close(),
  }
}

type Leitor = ReturnType<typeof leitorDoTerminal>

// Mostra a pergunta com as opções e lê as linhas: uma por item de casa, ou uma só nas outras.
async function responderNoTerminal(leitor: Leitor, p: Pergunta): Promise<RespostaDaPessoa> {
  console.log(formatarPergunta(p))
  const quantidade = p.tipo === "casa" ? p.itens.length : 1
  const linhas: string[] = []
  for (let k = 0; k < quantidade; k++) {
    process.stdout.write("> ")
    linhas.push(await leitor.proxima())
  }
  return respostaDoTexto(p, linhas)
}

// Mostra o bloco e lê uma linha: Enter anota tudo, números separados por vírgula desligam essas linhas, n é Agora não.
async function decidirNoTerminal(leitor: Leitor, propostas: PropostaNaSaida[]): Promise<string[]> {
  console.log(formatarBloco(propostas))
  console.log(
    "  Enter anota tudo; números separados por vírgula tiram essas linhas; n é Agora não.",
  )
  process.stdout.write("> ")
  return aprovadasDoTexto(propostas, await leitor.proxima())
}

// Caminho e interpretação só existem na conversa; sem eles, o bloco Entendi não aparece.
function camposDaConversa(
  r: RespostaDaConversa | RespostaDoRun,
): Pick<DadosDoRelatorio, "caminho" | "interpretacao"> {
  if (!("caminho" in r)) return {}
  return { caminho: r.caminho, ...(r.interpretacao ? { interpretacao: r.interpretacao } : {}) }
}

type Contexto = {
  cenario: Cenario | CenarioDeConversa
  deps: DepsDoCenario
  contaId: string
  kb: KnowledgeBase
  coletor: ReturnType<typeof coletorDePensamentos>
}

// Nome do item da casa: pelo nome da base quando tem alimento_id; senão, o nome livre.
function nomeDaCasa(item: ItemDaCasa, kb: KnowledgeBase): string {
  if (item.alimento_id) return kb.alimento(item.alimento_id)?.nome ?? item.alimento_id
  return item.nome_livre ?? ""
}

async function minhaCasaDo(ctx: Contexto): Promise<NonNullable<DadosDoRelatorio["minhaCasa"]>> {
  const itens = await ctx.deps.stores.pantry.listar(ctx.contaId)
  return itens.map((item) => ({ nome: nomeDaCasa(item, ctx.kb), estado: item.estado }))
}

async function relatorioDaRodada(
  ctx: Contexto,
  rodada: RodadaDoCenario,
): Promise<DadosDoRelatorio> {
  const runId = rodada.final.run_id
  const run = await ctx.deps.stores.runs.buscar(ctx.contaId, runId)
  if (!run) throw new Error(`run ${runId} não encontrado`)
  const etapas = await ctx.deps.stores.runs.etapas(ctx.contaId, runId)
  const decidido = rodada.bloco
  return {
    nome: ctx.cenario.nome,
    resposta: rodada.final,
    run,
    etapas,
    pensamentos: ctx.coletor.pensamentosDo(runId),
    disclaimer: config.app.disclaimer,
    perguntas: rodada.perguntas,
    ...camposDaConversa(rodada.final),
    nomeDoEvitar: nomeDoEvitarDaBase(ctx.kb),
    minhaCasa: await minhaCasaDo(ctx),
    ...(decidido
      ? {
          decisao: {
            aprovadas: decidido.aprovadas.length,
            gravadas: decidido.resultado.gravadas,
          },
        }
      : {}),
  }
}

// Com `depois`, a segunda mensagem vira um relatório aninhado, depois da linha "Depois: ...".
async function dadosDaSessao(ctx: Contexto, rodada: RodadaDoCenario): Promise<DadosDoRelatorio> {
  const principal = await relatorioDaRodada(ctx, rodada)
  const depois = ctx.cenario.depois
  if (!rodada.depois || !depois) return principal
  return {
    ...principal,
    depois: {
      mensagem: textoDaMensagem(depois.mensagem, ctx.kb),
      relatorio: await relatorioDaRodada(ctx, rodada.depois),
    },
  }
}

async function rodarDemo(
  nome: string,
  esgotar: Papel | undefined,
  llm: boolean,
  interativo: boolean,
): Promise<number> {
  const cenario = acharCenario(nome)
  if (!cenario) {
    console.error(`Cenário desconhecido: ${nome}. Liste com: npm run demo`)
    return 1
  }
  const container = getContainer()
  const opcoes: OpcoesDoCenario = {
    ...(llm ? { runtime: container.runtime, llm: container.llm } : {}),
    ...(esgotar ? { esgotar } : {}),
  }
  const { contaId, deps } = await montarCenario(cenario, opcoes)
  const coletor = coletorDePensamentos()
  const terminal = interativo ? leitorDoTerminal() : undefined
  try {
    const rodada = await rodarCenario(deps, contaId, cenario, {
      aoVivo: coletor.aoVivo,
      ...(terminal
        ? {
            responder: (p: Pergunta) => responderNoTerminal(terminal, p),
            decidir: (propostas: PropostaNaSaida[]) => decidirNoTerminal(terminal, propostas),
          }
        : {}),
    })
    const ctx: Contexto = { cenario, deps, contaId, kb: container.knowledge, coletor }
    console.log(formatarRelatorio(await dadosDaSessao(ctx, rodada)))
    return 0
  } finally {
    terminal?.fechar()
  }
}

async function main(args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      cenario: { type: "string" },
      esgotar: { type: "string" },
      llm: { type: "boolean", default: false },
      interativo: { type: "boolean", default: false },
    },
    strict: true,
  })
  if (values.cenario === undefined) {
    listarCenarios()
    return 0
  }
  if (values.esgotar !== undefined && !papelValido(values.esgotar)) {
    console.error(`Papel desconhecido em --esgotar: ${values.esgotar}`)
    return 1
  }
  return rodarDemo(values.cenario, values.esgotar, values.llm, values.interativo)
}

main(process.argv.slice(2))
  .then((codigo) => {
    process.exitCode = codigo
  })
  .catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : erro)
    process.exitCode = 1
  })
