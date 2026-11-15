// Roda o loop com o fake roteirizado e os stores em memória: um cenário de 4 passos com uma pausa.
// Não chama LLM nem banco. Sem OTEL_EXPORTER_OTLP_ENDPOINT, a telemetria fica nula.
// Uso: npm run loop:demo
import { z } from "zod"
import { filtroVazio } from "@/core/knowledge/filtros"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import type { DefinicaoDoAgente, ToolDeControle } from "@/core/runs/agente"
import { novoCheckpoint } from "@/core/runs/loop"
import type { RunEtapa } from "@/core/runs/ports"
import { createRunService } from "@/core/runs/run-service"
import { definirTool, type ToolContext } from "@/core/tools/tool"
import { getContainer } from "@/infra/container"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createFixedModel } from "@/infra/fakes/fixed-model"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"

const MENSAGEM = "Estou cansada e sem fome. O que eu como?"

// Tool de exemplo: consulta um item na casa da pessoa (aqui, sempre encontrado).
const consultar = definirTool({
  name: "consultar",
  description: "Diz se um item está em casa.",
  input: z.object({ item: z.string() }),
  output: z.object({ encontrado: z.boolean() }),
  resumir: (saida) => (saida.encontrado ? "item em casa" : "item fora"),
  executar: () => ({ encontrado: true }),
})

// Tool de controle que pausa e pergunta à pessoa.
const perguntar: ToolDeControle<unknown> = {
  name: "perguntar",
  description: "Pergunta algo à pessoa e pausa o run.",
  input: z.object({}),
  async tratar() {
    return {
      tipo: "pausar",
      pendencia: { tipo: "pergunta", conteudo: { pergunta: "Quer algo quente?" } },
    }
  },
  aoRetomar: (resposta) => ({ resposta }),
}

// Tool de controle que entrega a resposta.
const finalizar: ToolDeControle<unknown> = {
  name: "finalizar",
  description: "Entrega a resposta à pessoa.",
  input: z.object({}),
  async tratar() {
    return { tipo: "entregar", saida: { texto: "Uma sopa de legumes com gengibre." } }
  },
}

const agente: DefinicaoDoAgente = {
  nome: "demo",
  instrucoes: "Responda em texto, com uma ação simples para agora.",
  prompt_versao: "demo-1",
  tools: [consultar],
  controle: [perguntar, finalizar],
  lembreteDeEntrega: "Entregue a resposta com a tool finalizar.",
}

// Roteiro: tool, pausa, (retomada) tool, entregar.
const ROTEIRO = [
  { chamadas: [{ nome: "consultar", argumentos: { item: "gengibre" } }] },
  { chamadas: [{ nome: "perguntar", argumentos: {} }] },
  { chamadas: [{ nome: "consultar", argumentos: { item: "legumes" } }] },
  { chamadas: [{ nome: "finalizar", argumentos: {} }] },
]

function imprimirEtapas(etapas: RunEtapa[]): void {
  for (const e of etapas) {
    const resumo = e.resumo ? ` · ${e.resumo}` : ""
    console.log(`  ${e.ordem}. ${e.tipo} ${e.nome} [${e.status}]${resumo}`)
  }
}

async function main(): Promise<void> {
  const container = getContainer()
  await container.iniciarTelemetria()
  try {
    const clock = createFixedClock("2026-01-15T12:00:00-03:00")
    const stores = createMemoryStores(clock)
    const runtime = createScriptedRuntime(ROTEIRO, clock)
    const modelo = createFixedModel()
    const svc = createRunService({
      stores,
      tx: stores,
      runtime,
      clock,
      telemetry: container.telemetry,
    })
    const conta = await stores.accounts.criar({ tipo: "demo" })
    const ctx: ToolContext = {
      kb: createMiniKnowledge(),
      filtro: filtroVazio,
      sinais: sinaisVazios,
      clima: { fonte: createFakeWeather() },
      contaId: conta.id,
      stores,
      clock,
      telemetry: container.telemetry,
    }
    const run = await svc.iniciarRun(conta.id, { caminho: "acompanhante", intencoes: [] })

    console.log("1. Primeiro trecho, até a pausa")
    const primeiro = await svc.executarRun(conta.id, run.id, {
      agente,
      ctx,
      modelo,
      estado: novoCheckpoint(agente, MENSAGEM, {}),
    })
    console.log(`   fim: ${primeiro.fim.tipo}`)
    imprimirEtapas(await stores.runs.etapas(conta.id, run.id))

    console.log("2. Resposta da pessoa e retomada")
    const retomado = await svc.continuarRun(conta.id, run.id, {
      agente,
      ctx,
      modelo,
      resposta: "uma refeição simples",
    })
    console.log(`   fim: ${retomado.fim.tipo}`)
    await svc.encerrar(conta.id, run.id, "done")
    imprimirEtapas(await stores.runs.etapas(conta.id, run.id))

    const final = await stores.runs.buscar(conta.id, run.id)
    console.log(`Estado final: ${final?.status}`)
  } finally {
    await container.encerrar()
  }
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro)
  process.exit(1)
})
