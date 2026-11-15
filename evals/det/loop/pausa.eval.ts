import { describe, expect, it } from "vitest"
import { z } from "zod"
import type { DefinicaoDoAgente, ToolDeControle } from "@/core/runs/agente"
import { RunNaoContinuavelError } from "@/core/runs/errors"
import { novoCheckpoint } from "@/core/runs/loop"
import { createRunService } from "@/core/runs/run-service"
import type { ToolContext } from "@/core/tools/tool"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createFixedModel } from "@/infra/fakes/fixed-model"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createScriptedRuntime, type PassoRoteirizado } from "@/infra/fakes/scripted-runtime"

const ctx = {} as unknown as ToolContext
const MENSAGEM = "mensagem da pessoa"
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
  tools: [],
  controle: [finalizar, perguntar],
  lembreteDeEntrega: "entregue",
}
const perg = { nome: "perguntar", argumentos: {} }
const fin = { nome: "finalizar", argumentos: {} }

async function criar(roteiro: PassoRoteirizado[]) {
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
  const exec = { agente, ctx, modelo: createFixedModel() }
  return { stores, runtime, svc, conta, run, exec }
}

describe("pausa e continuação", () => {
  it("pausa grava checkpoint e pendência", async () => {
    const m = await criar([{ chamadas: [perg] }])
    const r = await m.svc.executarRun(m.conta.id, m.run.id, {
      ...m.exec,
      estado: novoCheckpoint(agente, MENSAGEM, {}),
    })
    expect(r.fim.tipo).toBe("pausa")
    expect(r.run.status).toBe("waiting_for_input")
    expect(r.run.checkpoint).toMatchObject({ versao: 1, chamadas_de_modelo: 1 })
    expect(r.run.pendencia).toMatchObject({ tipo: "pergunta", chamada_id: "c1" })
  })

  it("continuar retoma sem repetir passos", async () => {
    const m = await criar([{ chamadas: [perg] }, { chamadas: [fin] }])
    await m.svc.executarRun(m.conta.id, m.run.id, {
      ...m.exec,
      estado: novoCheckpoint(agente, MENSAGEM, {}),
    })
    const c = await m.svc.continuarRun(m.conta.id, m.run.id, { ...m.exec, resposta: "sim" })
    expect(c.fim).toEqual({ tipo: "entregue", saida: { texto: "oi" } })
    expect(c.run.passos).toBe(2)
    expect(m.runtime.pedidos).toHaveLength(2)
    expect(m.runtime.pedidos[1]?.mensagens).toContainEqual(
      expect.objectContaining({ papel: "tool", chamada_id: "c1", resultado: { resposta: "sim" } }),
    )
    const etapas = await m.stores.runs.etapas(m.conta.id, m.run.id)
    expect(etapas.filter((e) => e.tipo === "llm")).toHaveLength(2)
  })

  it("continuar um run expirado é recusado e não muda o status", async () => {
    const m = await criar([{ chamadas: [perg] }])
    await m.svc.executarRun(m.conta.id, m.run.id, {
      ...m.exec,
      estado: novoCheckpoint(agente, MENSAGEM, {}),
    })
    await m.stores.runs.atualizar(m.conta.id, m.run.id, { status: "expired" })
    await expect(
      m.svc.continuarRun(m.conta.id, m.run.id, { ...m.exec, resposta: "sim" }),
    ).rejects.toBeInstanceOf(RunNaoContinuavelError)
    expect((await m.stores.runs.buscar(m.conta.id, m.run.id))?.status).toBe("expired")
    expect(m.runtime.pedidos).toHaveLength(1)
  })
})
