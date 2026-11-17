// ⚠️ Chama o modelo real (Gemini, com GEMINI_API_KEY). Opt-in: roda só à mão, nos checkpoints (QA.md, "Checkpoints").
// Rodada nova de um checkpoint (recusa se há andamento ou se já houve rodada completa hoje):
//   npm run eval:llm -- --checkpoint c1-base
// Continua o andamento, apaga o andamento e começa, ou permite outra rodada no mesmo dia:
//   npm run eval:llm -- --checkpoint c1-base --retomar
//   npm run eval:llm -- --checkpoint c1-base --do-zero
//   npm run eval:llm -- --checkpoint c1-base --extra
// Roda um caso e imprime checagens, etapas e custo (não grava nada):
//   npm run eval:llm -- --checkpoint c1-base --caso <id>
// Lista os casos e a estimativa de chamadas, sem modelo, sem chave e sem container:
//   npm run eval:llm -- --checkpoint c3-confiavel --listar
// Este arquivo só lê os argumentos, monta o container (quando precisa) e grava os arquivos. A regra fica em scripts/lib/evals/comando.ts.
import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { acompanhanteV6 } from "@/core/agents/prompts/acompanhante.v6"
import { interpreteV2 } from "@/core/agents/prompts/interprete.v2"
import { juizV1 } from "@/core/agents/prompts/juiz.v1"
import { memoriaV1 } from "@/core/agents/prompts/memoria.v1"
import type { Clock } from "@/core/clock"
import { type Container, getContainer } from "@/infra/container"
import { llmCotas } from "../config/llm-cotas"
import { avaliadorV1 } from "../evals/llm/avaliador.v1"
import type { CasoDeEval } from "../evals/llm/casos"
import { criarRodarCaso, type Rodadores } from "./lib/evals/casos"
import { executarComando, type IoDoComando } from "./lib/evals/comando"
import { rodarInterprete, rodarJuiz, rodarMemoria } from "./lib/evals/rodar-apoio"
import { type CasoRodado, rodarAcompanhante, rodarConversa } from "./lib/evals/rodar-run"

const ausente = (erro: unknown): boolean => (erro as NodeJS.ErrnoException).code === "ENOENT"

// Container só quando a rodada ou o caso precisa dele: `--listar` não o monta.
let container: Container | undefined
function containerDoEval(): Container {
  container ??= getContainer()
  return container
}

// OTel só numa rodada: o --listar não chega aqui. Com OTEL_EXPORTER_OTLP_ENDPOINT, liga o SDK uma vez.
let telemetriaIniciada: Promise<void> | undefined
function iniciarTelemetriaDoEval(): Promise<void> {
  telemetriaIniciada ??= containerDoEval().iniciarTelemetria()
  return telemetriaIniciada
}

function rodadoresDo(c: Container): Rodadores {
  const deps = { client: c.llm, kb: c.knowledge, clock: c.clock, telemetria: c.telemetry }
  return {
    acompanhante: (caso) =>
      rodarAcompanhante(caso, { runtime: c.runtime, telemetria: c.telemetry }),
    interprete: (caso) => rodarInterprete(caso, deps),
    conversa: (caso) =>
      rodarConversa(caso, { runtime: c.runtime, llm: c.llm, telemetria: c.telemetry }),
    memoria: (caso) => rodarMemoria(caso, deps),
    juiz: (caso) => rodarJuiz(caso, deps),
  }
}

let rodarCasoDoEval: ((caso: CasoDeEval) => Promise<CasoRodado>) | undefined
async function rodarCaso(caso: CasoDeEval): Promise<CasoRodado> {
  await iniciarTelemetriaDoEval()
  if (rodarCasoDoEval === undefined) {
    const c = containerDoEval()
    rodarCasoDoEval = criarRodarCaso({
      rodadores: rodadoresDo(c),
      avaliador: {
        router: c.router,
        client: c.llm,
        telemetry: c.telemetry,
        clock: c.clock,
        kb: c.knowledge,
      },
    })
  }
  return rodarCasoDoEval(caso)
}

const io: IoDoComando = {
  ler: async (caminho) => {
    try {
      return await readFile(caminho, "utf8")
    } catch (erro) {
      if (ausente(erro)) return undefined
      throw erro
    }
  },
  gravar: async (caminho, texto) => {
    await mkdir(dirname(caminho), { recursive: true })
    await writeFile(caminho, texto, "utf8")
  },
  anexar: async (caminho, texto) => {
    await mkdir(dirname(caminho), { recursive: true })
    await appendFile(caminho, texto, "utf8")
  },
  apagar: (caminho) => rm(caminho, { force: true }),
  log: (linha) => console.log(linha),
  erro: (linha) => console.error(linha),
  get clock(): Clock {
    return containerDoEval().clock
  },
  esperar: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
  prompts: {
    acompanhante: acompanhanteV6.versao,
    interprete: interpreteV2.versao,
    memoria: memoriaV1.versao,
    juiz: juizV1.versao,
    avaliador: avaliadorV1.versao,
  },
  papeis: llmCotas.papeis,
  rodarCaso,
}

async function main(): Promise<number> {
  try {
    return await executarComando(process.argv.slice(2), io)
  } catch {
    // Sem a mensagem bruta: o erro de driver pode trazer a URL do banco.
    console.error("Falha desconhecida no eval")
    return 1
  } finally {
    await container?.encerrar()
  }
}

process.exitCode = await main()
