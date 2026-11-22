import { describe, expect, it } from "vitest"
import { z } from "zod"
import type { DefinicaoDoAgente, ToolDeControle } from "@/core/runs/agente"
import { novoCheckpoint } from "@/core/runs/loop"
import type { RunEtapa } from "@/core/runs/ports"
import { createRunService } from "@/core/runs/run-service"
import { definirTool, type ToolContext } from "@/core/tools/tool"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createFixedModel } from "@/infra/fakes/fixed-model"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { lerComoPensei } from "./ler"

const FUSO = "America/Sao_Paulo"
const kb = createMiniKnowledge()
const ctx = {} as unknown as ToolContext

const toolA = definirTool({
  name: "a",
  description: "A",
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  executar: () => ({ ok: true }),
})
const finalizar: ToolDeControle<unknown> = {
  name: "finalizar",
  description: "entrega",
  input: z.object({}),
  async tratar() {
    return { tipo: "entregar", saida: { texto: "oi" } }
  },
}
const agente: DefinicaoDoAgente = {
  nome: "teste",
  instrucoes: "instr",
  prompt_versao: "v1",
  tools: [toolA] as never,
  controle: [finalizar],
  lembreteDeEntrega: "entregue",
}

async function montar() {
  const clock = createFixedClock("2026-11-17T15:00:00Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const runtime = createScriptedRuntime(
    [
      { chamadas: [{ nome: "a", argumentos: {} }] },
      { chamadas: [{ nome: "finalizar", argumentos: {} }] },
    ],
    clock,
  )
  const svc = createRunService({ stores, tx: stores, runtime, clock, telemetry })
  const conta = await stores.accounts.criar({ tipo: "demo" })
  const outra = await stores.accounts.criar({ tipo: "demo" })
  const etapas: RunEtapa[] = []
  const run = await svc.iniciarRun(conta.id, { caminho: "acompanhante", intencoes: [] })
  await svc.executarRun(conta.id, run.id, {
    agente,
    ctx,
    modelo: createFixedModel(),
    aoGravarEtapa: (e) => etapas.push(e),
    estado: novoCheckpoint(agente, "mensagem da pessoa", {}),
  })
  await svc.encerrar(conta.id, run.id, "done")
  return { clock, stores, conta, outra, run }
}

describe("lerComoPensei", () => {
  it("run de outra conta é undefined", async () => {
    const m = await montar()
    const deps = { stores: m.stores, kb, clock: m.clock }
    expect(await lerComoPensei(deps, m.outra.id, m.run.id, FUSO)).toBeUndefined()
  })

  it("run inexistente é undefined", async () => {
    const m = await montar()
    const deps = { stores: m.stores, kb, clock: m.clock }
    expect(await lerComoPensei(deps, m.conta.id, "nao-existe", FUSO)).toBeUndefined()
  })

  it("run do roteiro demo é pronto, com passos e o fim por último", async () => {
    const m = await montar()
    const deps = { stores: m.stores, kb, clock: m.clock }
    const linha = await lerComoPensei(deps, m.conta.id, m.run.id, FUSO)
    expect(linha?.estado).toBe("pronto")
    if (linha?.estado !== "pronto") throw new Error("esperava pronto")
    expect(linha.passos.length).toBeGreaterThan(0)
    expect(linha.passos[linha.passos.length - 1]?.tipo).toBe("fim")
  })
})
