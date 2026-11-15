import { describe, expect, it } from "vitest"
import { z } from "zod"
import type { DefinicaoDoAgente, ToolDeControle } from "@/core/runs/agente"
import { novoCheckpoint } from "@/core/runs/loop"
import { createRunService } from "@/core/runs/run-service"
import { ATRIBUTOS_PERMITIDOS } from "@/core/telemetry/nomes"
import { definirTool, type ToolContext } from "@/core/tools/tool"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createFixedModel } from "@/infra/fakes/fixed-model"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"

const ctx = {} as unknown as ToolContext
const MENSAGEM = "quero um chá para a tarde"
const ferramenta = definirTool({
  name: "a",
  description: "A",
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  executar: () => ({ ok: true }),
})
const finalizar: ToolDeControle<unknown> = {
  name: "finalizar",
  description: "Entrega a resposta.",
  input: z.object({}),
  async tratar() {
    return { tipo: "entregar", saida: { texto: "oi" } }
  },
}
const perguntar: ToolDeControle<unknown> = {
  name: "perguntar",
  description: "Pergunta à pessoa.",
  input: z.object({}),
  async tratar() {
    return { tipo: "pausar", pendencia: { tipo: "pergunta", conteudo: { q: 1 } } }
  },
  aoRetomar: (resposta) => ({ resposta }),
}
const agente: DefinicaoDoAgente = {
  nome: "teste",
  instrucoes: "instr",
  prompt_versao: "v1",
  tools: [ferramenta],
  controle: [finalizar, perguntar],
  lembreteDeEntrega: "entregue",
}

// Roteiro: o primeiro passo dá rate_limit e o modelo troca; depois tool, pausa e, na retomada, entregar.
async function cenarioComPausa() {
  const clock = createFixedClock("2026-01-01T12:00:00Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const runtime = createScriptedRuntime(
    [
      { erro: "rate_limit" },
      { chamadas: [{ nome: "a", argumentos: {} }] },
      { chamadas: [{ nome: "perguntar", argumentos: {} }] },
      { chamadas: [{ nome: "finalizar", argumentos: {} }] },
    ],
    clock,
  )
  const svc = createRunService({ stores, tx: stores, runtime, clock, telemetry })
  const conta = await stores.accounts.criar({ tipo: "demo" })
  const run = await svc.iniciarRun(conta.id, { caminho: "acompanhante", intencoes: [] })
  const exec = { agente, ctx, modelo: createFixedModel() }
  await svc.executarRun(conta.id, run.id, { ...exec, estado: novoCheckpoint(agente, MENSAGEM, {}) })
  await svc.continuarRun(conta.id, run.id, { ...exec, resposta: "sim" })
  const etapas = await stores.runs.etapas(conta.id, run.id)
  return { telemetry, etapas }
}

describe("rastro do loop com pausa", () => {
  it("a árvore de spans sai na ordem: run, passos, chamadas e a retomada no mesmo trace", async () => {
    const { telemetry } = await cenarioComPausa()
    expect(telemetry.spans.map((s) => [s.nome, s.pai])).toEqual([
      ["run", undefined],
      ["agente.passo", 0],
      ["llm.chamada", 1],
      ["tool.chamada", 1],
      ["agente.passo", 0],
      ["llm.chamada", 4],
      ["tool.chamada", 4],
      ["run", undefined],
      ["agente.passo", 7],
      ["llm.chamada", 8],
      ["tool.chamada", 8],
    ])
    expect(new Set(telemetry.spans.map((s) => s.trace)).size).toBe(1)
  })

  it("as etapas saem na ordem, com a troca de modelo e a pergunta", async () => {
    const { etapas } = await cenarioComPausa()
    expect(etapas.map((e) => [e.ordem, e.tipo, e.nome, e.status])).toEqual([
      [1, "troca_de_modelo", "modelo-b", "ok"],
      [2, "llm", "modelo-b", "ok"],
      [3, "tool", "a", "ok"],
      [4, "llm", "modelo-b", "ok"],
      [5, "pergunta", "perguntar", "ok"],
      [6, "llm", "modelo-b", "ok"],
      [7, "validacao", "finalizar", "ok"],
    ])
  })

  it("a pausa gera o evento e as métricas de pausa e de erro de LLM", async () => {
    const { telemetry } = await cenarioComPausa()
    expect(telemetry.eventos).toEqual([{ nome: "pausa", atributos: { "pausa.tipo": "pergunta" } }])
    expect(telemetry.metricas).toContainEqual(
      expect.objectContaining({
        nome: "ritu_pausas_total",
        valor: 1,
        rotulos: { tipo: "pergunta" },
      }),
    )
    expect(telemetry.metricas).toContainEqual(
      expect.objectContaining({
        nome: "ritu_llm_erros_total",
        valor: 1,
        rotulos: { "erro.codigo": "rate_limit" },
      }),
    )
  })

  it("nenhum atributo fora da lista e nenhum com o texto da mensagem", async () => {
    const { telemetry } = await cenarioComPausa()
    const permitidos = new Set<string>(ATRIBUTOS_PERMITIDOS)
    const chaves = [
      ...telemetry.spans.flatMap((s) => Object.keys(s.atributos)),
      ...telemetry.eventos.flatMap((e) => Object.keys(e.atributos)),
      ...telemetry.metricas.flatMap((m) => Object.keys(m.rotulos)),
      ...telemetry.logs.flatMap((l) => Object.keys(l.campos)),
    ]
    for (const chave of chaves) expect(permitidos.has(chave)).toBe(true)
    const tudo = JSON.stringify([
      telemetry.spans,
      telemetry.eventos,
      telemetry.metricas,
      telemetry.logs,
    ])
    expect(tudo).not.toContain(MENSAGEM)
  })
})
