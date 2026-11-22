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
import { acompanhanteV8 } from "@/core/agents/prompts/acompanhante.v8"
import { interpreteV2 } from "@/core/agents/prompts/interprete.v2"
import { juizV1 } from "@/core/agents/prompts/juiz.v1"
import { memoriaV1 } from "@/core/agents/prompts/memoria.v1"
import type { Clock } from "@/core/clock"
import {
  type Container,
  chavesDoGemini,
  consultarBanco,
  getContainer,
  listarModelosDaChave,
  variavelDaChave,
} from "@/infra/container"
import { llmCotas } from "../config/llm-cotas"
import { avaliadorV1 } from "../evals/llm/avaliador.v1"
import type { CasoDeEval } from "../evals/llm/casos"
import type { AlvoDoCheckpoint } from "../evals/llm/checkpoints"
import { criarRodarCaso, type Rodadores } from "./lib/evals/casos"
import type { ChecagemPrevia } from "./lib/evals/checagem-previa"
import { executarComando, type IoDoComando } from "./lib/evals/comando"
import { rodarInterprete, rodarJuiz, rodarMemoria } from "./lib/evals/rodar-apoio"
import { rodarAcompanhantePelasRotas, rodarConversaPelasRotas } from "./lib/evals/rodar-rotas"
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

// Acompanhante e conversa: pelo código do agente (`codigo`) ou pelas rotas do site (`rotas`). Intérprete, memória e juiz são iguais nos dois.
function rodadoresDo(c: Container, alvo: AlvoDoCheckpoint): Rodadores {
  const deps = { client: c.llm, kb: c.knowledge, clock: c.clock, telemetria: c.telemetry }
  const pelasRotas = alvo === "rotas"
  const opts = { runtime: c.runtime, telemetria: c.telemetry }
  return {
    acompanhante: (caso) =>
      pelasRotas ? rodarAcompanhantePelasRotas(caso, opts) : rodarAcompanhante(caso, opts),
    interprete: (caso) => rodarInterprete(caso, deps),
    conversa: (caso) =>
      pelasRotas
        ? rodarConversaPelasRotas(caso, { ...opts, llm: c.llm })
        : rodarConversa(caso, { ...opts, llm: c.llm }),
    memoria: (caso) => rodarMemoria(caso, deps),
    juiz: (caso) => rodarJuiz(caso, deps),
  }
}

// Um rodador de caso por alvo, criado na primeira vez que o alvo aparece.
const rodadoresDeCasoPorAlvo = new Map<
  AlvoDoCheckpoint,
  (caso: CasoDeEval) => Promise<CasoRodado>
>()
async function rodarCaso(caso: CasoDeEval, alvo: AlvoDoCheckpoint): Promise<CasoRodado> {
  await iniciarTelemetriaDoEval()
  let rodarDoAlvo = rodadoresDeCasoPorAlvo.get(alvo)
  if (rodarDoAlvo === undefined) {
    const c = containerDoEval()
    rodarDoAlvo = criarRodarCaso({
      rodadores: rodadoresDo(c, alvo),
      avaliador: {
        router: c.router,
        client: c.llm,
        telemetry: c.telemetry,
        clock: c.clock,
        kb: c.knowledge,
      },
    })
    rodadoresDeCasoPorAlvo.set(alvo, rodarDoAlvo)
  }
  return rodarDoAlvo(caso)
}

// As mesmas chaves do container (chavesDoGemini); banco e listagem vêm do container, o único que liga à infra.
function checagemDoEval(): ChecagemPrevia {
  return {
    banco: consultarBanco,
    chaves: chavesDoGemini().map((n) => ({
      variavel: variavelDaChave(n),
      listar: () => listarModelosDaChave(n),
    })),
  }
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
    acompanhante: acompanhanteV8.versao,
    interprete: interpreteV2.versao,
    memoria: memoriaV1.versao,
    juiz: juizV1.versao,
    avaliador: avaliadorV1.versao,
  },
  papeis: llmCotas.papeis,
  rodarCaso,
  get checagem(): ChecagemPrevia {
    return checagemDoEval()
  },
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
