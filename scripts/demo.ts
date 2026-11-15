// Demonstração do Acompanhante. Sem argumento, lista os cenários. Com --cenario, roda um deles
// com o runtime roteirizado, sem rede. Com --llm (⚠️ chama o modelo real), troca só o runtime.
// Uso: npm run demo | npm run demo -- --cenario <nome> [--esgotar decisao] [--llm]
import { parseArgs } from "node:util"
import { config, llmCotas, type Papel } from "@config/index"
import type { EventoAoVivo } from "@/core/runs/loop"
import { getContainer } from "@/infra/container"
import { cenarios, montarCenario, type OpcoesDoCenario } from "../test/fixtures/cenarios"
import { formatarRelatorio, type Pensamento } from "./lib/demo-report"

function papelValido(nome: string): nome is Papel {
  return Object.hasOwn(llmCotas.papeis, nome)
}

function listarCenarios(): void {
  console.log("Cenários:")
  for (const c of Object.values(cenarios)) console.log(`  ${c.nome}  ${c.descricao}`)
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

async function rodarCenario(
  nome: string,
  esgotar: Papel | undefined,
  llm: boolean,
): Promise<number> {
  const cenario = Object.hasOwn(cenarios, nome) ? cenarios[nome] : undefined
  if (!cenario) {
    console.error(`Cenário desconhecido: ${nome}. Liste com: npm run demo`)
    return 1
  }
  const opcoes: OpcoesDoCenario = {
    ...(llm ? { runtime: getContainer().runtime } : {}),
    ...(esgotar ? { esgotar } : {}),
  }
  const { contaId, deps } = await montarCenario(cenario, opcoes)
  const coletor = coletorDePensamentos()
  const resposta = await deps.companion.responder(contaId, cenario.entrada, {
    aoVivo: coletor.aoVivo,
  })
  const run = await deps.stores.runs.buscar(contaId, resposta.run_id)
  if (!run) throw new Error(`run ${resposta.run_id} não encontrado`)
  const etapas = await deps.stores.runs.etapas(contaId, resposta.run_id)
  console.log(
    formatarRelatorio({
      nome: cenario.nome,
      resposta,
      run,
      etapas,
      pensamentos: coletor.pensamentos,
      disclaimer: config.app.disclaimer,
    }),
  )
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
