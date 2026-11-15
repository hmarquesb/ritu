import { llmCotas } from "@config/llm-cotas"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { createModelRouter } from "@/core/llm/router"
import type { DefinicaoDoAgente, ToolDeControle } from "@/core/runs/agente"
import { novoCheckpoint } from "@/core/runs/loop"
import { createRunService } from "@/core/runs/run-service"
import { definirTool, type ToolContext } from "@/core/tools/tool"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger, createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createScriptedRuntime, type PassoRoteirizado } from "@/infra/fakes/scripted-runtime"

const ctx = {} as unknown as ToolContext
const ok = definirTool({
  name: "ok",
  description: "Funciona.",
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
const agente: DefinicaoDoAgente = {
  nome: "teste",
  instrucoes: "instr",
  prompt_versao: "v1",
  tools: [ok],
  controle: [finalizar],
  lembreteDeEntrega: "entregue",
}
const [principal, segundo] = llmCotas.papeis.decisao

async function rodar(roteiro: PassoRoteirizado[]) {
  const clock = createFixedClock("2026-01-15T12:00:00Z")
  const stores = createMemoryStores(clock)
  const runtime = createScriptedRuntime(roteiro, clock)
  const telemetry = createMemoryTelemetry()
  const router = createModelRouter({ ledger: createMemoryLedger(clock), clock, telemetry })
  const svc = createRunService({ stores, tx: stores, runtime, clock, telemetry })
  const conta = await stores.accounts.criar({ tipo: "demo" })
  const run = await svc.iniciarRun(conta.id, { caminho: "acompanhante", intencoes: [] })
  const resultado = await svc.executarRun(conta.id, run.id, {
    agente,
    ctx,
    modelo: router.paraPapel("decisao"),
    estado: novoCheckpoint(agente, "mensagem", {}),
  })
  const etapas = await stores.runs.etapas(conta.id, run.id)
  return {
    ...resultado,
    etapas,
    telemetry,
    pedidos: runtime.pedidos,
    svc,
    stores,
    conta,
    runInicial: run,
  }
}

describe("loop com o roteador real: rate_limit no meio do run", () => {
  it("troca de modelo sem contar a chamada barrada e termina em done", async () => {
    const r = await rodar([
      { chamadas: [{ nome: "ok", argumentos: {} }] },
      { erro: "rate_limit" },
      { chamadas: [{ nome: "finalizar", argumentos: {} }] },
    ])
    expect(r.fim).toEqual({ tipo: "entregue", saida: { texto: "oi" } })
    expect(r.run.passos).toBe(2)
    expect(r.pedidos).toHaveLength(3)
    expect(r.pedidos[0]?.modelo).toBe(principal)
    expect(r.pedidos[2]?.modelo).toBe(segundo)
    await r.svc.encerrar(r.conta.id, r.runInicial.id, "done")
    expect((await r.stores.runs.buscar(r.conta.id, r.runInicial.id))?.status).toBe("done")
  })

  it("grava a etapa troca_de_modelo com o motivo 429 e a métrica de troca", async () => {
    const r = await rodar([
      { chamadas: [{ nome: "ok", argumentos: {} }] },
      { erro: "rate_limit" },
      { chamadas: [{ nome: "finalizar", argumentos: {} }] },
    ])
    expect(r.etapas).toContainEqual(
      expect.objectContaining({ tipo: "troca_de_modelo", nome: segundo, resumo: "429" }),
    )
    expect(r.etapas.filter((e) => e.tipo === "llm")).toHaveLength(2)
    expect(r.telemetry.metricas).toContainEqual(
      expect.objectContaining({
        nome: "ritu_llm_troca_de_modelo_total",
        rotulos: { papel: "decisao", de: principal, para: segundo, motivo: "429" },
      }),
    )
  })
})
