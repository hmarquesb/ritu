import { describe, expect, it } from "vitest"
import { z } from "zod"
import type { DefinicaoDoAgente, ToolDeControle } from "@/core/runs/agente"
import { novoCheckpoint } from "@/core/runs/loop"
import { createRunService } from "@/core/runs/run-service"
import type { ToolContext } from "@/core/tools/tool"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createFixedModel } from "@/infra/fakes/fixed-model"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createScriptedRuntime, type PassoRoteirizado } from "@/infra/fakes/scripted-runtime"

const ctx = {} as unknown as ToolContext
const recusar: ToolDeControle<unknown> = {
  name: "recusar",
  description: "Recusa a entrega.",
  input: z.object({}),
  async tratar() {
    return { tipo: "recusar", resultado: { motivo: "falta_info" } }
  },
}
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
  tools: [],
  controle: [recusar, finalizar],
  lembreteDeEntrega: "entregue",
}

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
  return { ...resultado, pedidos: runtime.pedidos }
}

describe("entrega recusada", () => {
  it("volta ao modelo como resultado da tool e a entrega seguinte fecha o run", async () => {
    const r = await rodar([
      { chamadas: [{ nome: "recusar", argumentos: {} }] },
      { chamadas: [{ nome: "finalizar", argumentos: {} }] },
    ])
    expect(r.fim).toEqual({ tipo: "entregue", saida: { texto: "oi" } })
    expect(r.pedidos[1]?.mensagens).toContainEqual(
      expect.objectContaining({
        papel: "tool",
        nome: "recusar",
        resultado: { motivo: "falta_info" },
      }),
    )
  })

  it("a 3ª recusa encerra com limite validacao, sem pedir um 4º passo", async () => {
    const recusa = { chamadas: [{ nome: "recusar", argumentos: {} }] }
    const r = await rodar([recusa, recusa, recusa])
    expect(r.fim).toEqual({ tipo: "limite", motivo: "validacao" })
    expect(r.pedidos).toHaveLength(3)
    expect(r.run.passos).toBe(3)
  })
})
