// Demonstração do Acompanhante e da conversa. Sem argumento, lista os cenários. Com --cenario, roda um deles
// com o runtime roteirizado, sem rede. Com --llm (⚠️ chama o modelo real), troca o runtime e o cliente do modelo.
// Uso: npm run demo | npm run demo -- --cenario <nome> [--esgotar decisao] [--llm]
import { parseArgs } from "node:util"
import { config, llmCotas, type Papel } from "@config/index"
import type { RespostaDaConversa } from "@/core/conversation/conversar"
import type { EvitarItem } from "@/core/knowledge/filtros"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { EventoAoVivo } from "@/core/runs/loop"
import type { Caminho } from "@/core/runs/ports"
import { getContainer } from "@/infra/container"
import {
  type Cenario,
  cenarios,
  cenariosDeConversa,
  type DepsDoCenario,
  montarCenario,
  type OpcoesDoCenario,
} from "../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../test/fixtures/cenarios/tipos"
import {
  type DadosDoRelatorio,
  formatarRelatorio,
  type Pensamento,
  type RespostaDoRelatorio,
} from "./lib/demo-report"

function papelValido(nome: string): nome is Papel {
  return Object.hasOwn(llmCotas.papeis, nome)
}

function listarCenarios(): void {
  console.log("Cenários:")
  for (const c of [...Object.values(cenarios), ...Object.values(cenariosDeConversa)]) {
    console.log(`  ${c.nome}  ${c.descricao}`)
  }
}

function acharCenario(nome: string): Cenario | CenarioDeConversa | undefined {
  if (Object.hasOwn(cenarios, nome)) return cenarios[nome]
  if (Object.hasOwn(cenariosDeConversa, nome)) return cenariosDeConversa[nome]
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

// Com mensagem, o cenário passa pela conversa; sem, vai direto ao Acompanhante (007).
type Execucao = {
  resposta: RespostaDoRelatorio
  caminho?: Caminho
  interpretacao?: RespostaDaConversa["interpretacao"]
}

async function executar(
  cenario: Cenario | CenarioDeConversa,
  deps: DepsDoCenario,
  contaId: string,
  aoVivo: (e: EventoAoVivo) => void,
): Promise<Execucao> {
  if (cenario.mensagem) {
    const r = await deps.conversation.conversar(contaId, cenario.mensagem, { aoVivo })
    return { resposta: r, caminho: r.caminho, interpretacao: r.interpretacao }
  }
  if (!cenario.entrada) throw new Error(`cenário ${cenario.nome} sem entrada nem mensagem`)
  const resposta = await deps.companion.responder(contaId, cenario.entrada, { aoVivo })
  return { resposta }
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

async function rodarCenario(
  nome: string,
  esgotar: Papel | undefined,
  llm: boolean,
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
  const execucao = await executar(cenario, deps, contaId, coletor.aoVivo)
  const run = await deps.stores.runs.buscar(contaId, execucao.resposta.run_id)
  if (!run) throw new Error(`run ${execucao.resposta.run_id} não encontrado`)
  const etapas = await deps.stores.runs.etapas(contaId, execucao.resposta.run_id)
  const dados: DadosDoRelatorio = {
    nome: cenario.nome,
    resposta: execucao.resposta,
    run,
    etapas,
    pensamentos: coletor.pensamentos,
    disclaimer: config.app.disclaimer,
    ...(execucao.caminho ? { caminho: execucao.caminho } : {}),
    ...(execucao.interpretacao ? { interpretacao: execucao.interpretacao } : {}),
    nomeDoEvitar: nomeDoEvitarDaBase(container.knowledge),
  }
  console.log(formatarRelatorio(dados))
  return 0
}

async function main(args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      cenario: { type: "string" },
      esgotar: { type: "string" },
      llm: { type: "boolean", default: false },
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
  return rodarCenario(values.cenario, values.esgotar, values.llm)
}

main(process.argv.slice(2))
  .then((codigo) => {
    process.exitCode = codigo
  })
  .catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : erro)
    process.exitCode = 1
  })
