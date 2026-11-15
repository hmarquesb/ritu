// Demonstração do Acompanhante e da conversa. Sem argumento, lista os cenários. Com --cenario, roda um deles
// com o runtime roteirizado, sem rede. Com --llm (⚠️ chama o modelo real), troca o runtime e o cliente do modelo.
// Com --interativo, lê do terminal a resposta de cada pergunta (uma linha por item de casa, ou uma por pergunta).
// Uso: npm run demo | npm run demo -- --cenario <nome> [--esgotar decisao] [--llm] [--interativo]
import { createInterface } from "node:readline"
import { parseArgs } from "node:util"
import { config, llmCotas, type Papel } from "@config/index"
import type { RespostaDoRun } from "@/core/agents/companion/responder"
import type { RespostaDaConversa } from "@/core/conversation/conversar"
import type { EvitarItem } from "@/core/knowledge/filtros"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { EventoAoVivo } from "@/core/runs/loop"
import type { Pergunta, RespostaDaPessoa } from "@/core/runs/pergunta"
import { getContainer } from "@/infra/container"
import {
  type Cenario,
  cenarios,
  cenariosComPausa,
  cenariosDeConversa,
  montarCenario,
  type OpcoesDoCenario,
  rodarCenario,
} from "../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../test/fixtures/cenarios/tipos"
import { type DadosDoRelatorio, formatarRelatorio, type Pensamento } from "./lib/demo-report"
import { formatarPergunta, respostaDoTexto } from "./lib/demo-resposta"

function papelValido(nome: string): nome is Papel {
  return Object.hasOwn(llmCotas.papeis, nome)
}

function listarCenarios(): void {
  console.log("Cenários:")
  const todos = [
    ...Object.values(cenarios),
    ...Object.values(cenariosDeConversa),
    ...Object.values(cenariosComPausa),
  ]
  for (const c of todos) {
    console.log(`  ${c.nome}  ${c.descricao}`)
  }
}

function acharCenario(nome: string): Cenario | CenarioDeConversa | undefined {
  if (Object.hasOwn(cenarios, nome)) return cenarios[nome]
  if (Object.hasOwn(cenariosDeConversa, nome)) return cenariosDeConversa[nome]
  if (Object.hasOwn(cenariosComPausa, nome)) return cenariosComPausa[nome]
  return undefined
}

// Guarda os pensamentos com a ordem da última etapa concluída, para o relatório encaixar cada um.
function coletorDePensamentos() {
  const pensamentos: Pensamento[] = []
  let ultimaOrdem = 0
  return {
    pensamentos,
    aoVivo(e: EventoAoVivo): void {
      if (e.tipo === "etapa_concluida") ultimaOrdem = e.etapa.ordem
      if (e.tipo === "pensamento") pensamentos.push({ depoisDaOrdem: ultimaOrdem, texto: e.texto })
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

// Caminho e interpretação só existem na conversa; sem eles, os blocos Entendi e Posso anotar não aparecem.
function camposDaConversa(
  r: RespostaDaConversa | RespostaDoRun,
): Pick<DadosDoRelatorio, "caminho" | "interpretacao"> {
  if (!("caminho" in r)) return {}
  return { caminho: r.caminho, ...(r.interpretacao ? { interpretacao: r.interpretacao } : {}) }
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
      ...(terminal ? { responder: (p) => responderNoTerminal(terminal, p) } : {}),
    })
    const run = await deps.stores.runs.buscar(contaId, rodada.final.run_id)
    if (!run) throw new Error(`run ${rodada.final.run_id} não encontrado`)
    const etapas = await deps.stores.runs.etapas(contaId, rodada.final.run_id)
    const dados: DadosDoRelatorio = {
      nome: cenario.nome,
      resposta: rodada.final,
      run,
      etapas,
      pensamentos: coletor.pensamentos,
      disclaimer: config.app.disclaimer,
      perguntas: rodada.perguntas,
      ...camposDaConversa(rodada.final),
      nomeDoEvitar: nomeDoEvitarDaBase(container.knowledge),
    }
    console.log(formatarRelatorio(dados))
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
