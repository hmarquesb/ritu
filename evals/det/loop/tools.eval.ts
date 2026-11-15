import { describe, expect, it } from "vitest"
import { z } from "zod"
import type { DefinicaoDoAgente, ToolDeControle } from "@/core/runs/agente"
import { novoCheckpoint } from "@/core/runs/loop"
import { createRunService } from "@/core/runs/run-service"
import { definirTool, type ToolContext } from "@/core/tools/tool"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createFixedModel } from "@/infra/fakes/fixed-model"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
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
const falha = definirTool({
  name: "falha",
  description: "Sempre quebra.",
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  executar: () => {
    throw new Error("quebrou")
  },
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
  tools: [ok, falha],
  controle: [finalizar],
  lembreteDeEntrega: "entregue",
}
const fin = { nome: "finalizar", argumentos: {} }

async function rodar(roteiro: PassoRoteirizado[]) {
  const clock = createFixedClock("2026-01-01T12:00:00Z")
  const stores = createMemoryStores(clock)
  const runtime = createScriptedRuntime(roteiro, clock)
  const svc = createRunService({
    stores,
    tx: stores,
    runtime,
    clock,
    telemetry: createMemoryTelemetry(),
  })
  const conta = await stores.accounts.criar({ tipo: "demo" })
  const run = await svc.iniciarRun(conta.id, { caminho: "acompanhante", intencoes: [] })
  const resultado = await svc.executarRun(conta.id, run.id, {
    agente,
    ctx,
    modelo: createFixedModel(),
    estado: novoCheckpoint(agente, "mensagem", {}),
  })
  const etapas = await stores.runs.etapas(conta.id, run.id)
  return { ...resultado, etapas, pedidos: runtime.pedidos }
}

describe("tools do loop", () => {
  it("tool fora do catálogo é recusada, vira etapa e o run segue até entregar", async () => {
    const r = await rodar([
      { chamadas: [{ nome: "inexistente", argumentos: {} }] },
      { chamadas: [fin] },
    ])
    expect(r.fim).toEqual({ tipo: "entregue", saida: { texto: "oi" } })
    expect(r.etapas).toContainEqual(
      expect.objectContaining({ tipo: "erro", nome: "inexistente", status: "recusado" }),
    )
  })

  it("tool que falha não derruba o run: vira etapa falhou e o modelo recebe o erro", async () => {
    const r = await rodar([{ chamadas: [{ nome: "falha", argumentos: {} }] }, { chamadas: [fin] }])
    expect(r.fim).toEqual({ tipo: "entregue", saida: { texto: "oi" } })
    expect(r.run.status).toBe("running")
    expect(r.etapas).toContainEqual(
      expect.objectContaining({ tipo: "tool", nome: "falha", status: "falhou" }),
    )
    expect(r.pedidos[1]?.mensagens).toContainEqual(
      expect.objectContaining({ papel: "tool", nome: "falha", resultado: { erro: "falhou" } }),
    )
  })

  it("tool que funciona vira etapa ok", async () => {
    const r = await rodar([{ chamadas: [{ nome: "ok", argumentos: {} }] }, { chamadas: [fin] }])
    expect(r.etapas).toContainEqual(
      expect.objectContaining({ tipo: "tool", nome: "ok", status: "ok" }),
    )
  })
})
