import { describe, expect, it } from "vitest"
import { z } from "zod"
import type { DefinicaoDoAgente } from "@/core/runs/agente"
import { novoCheckpoint } from "@/core/runs/loop"
import { createRunService } from "@/core/runs/run-service"
import { definirTool, type ToolContext } from "@/core/tools/tool"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createFixedModel } from "@/infra/fakes/fixed-model"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createScriptedRuntime, type PassoRoteirizado } from "@/infra/fakes/scripted-runtime"

const ctx = {} as unknown as ToolContext
const ferramenta = definirTool({
  name: "a",
  description: "A",
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  executar: () => ({ ok: true }),
})
const agente: DefinicaoDoAgente = {
  nome: "teste",
  instrucoes: "instr",
  prompt_versao: "v1",
  tools: [ferramenta],
  controle: [],
  lembreteDeEntrega: "entregue",
}
const chamaFerramenta = { nome: "a", argumentos: {} }

async function rodar(
  roteiro: PassoRoteirizado[],
  clock = createFixedClock("2026-01-01T12:00:00Z"),
) {
  const stores = createMemoryStores(clock)
  const svc = createRunService({
    stores,
    tx: stores,
    runtime: createScriptedRuntime(roteiro, clock),
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
  return resultado
}

describe("limites do loop", () => {
  it("teto de chamadas de modelo: a 6ª chamada é a última e o fim é limite chamadas", async () => {
    const roteiro = Array.from({ length: 6 }, () => ({ chamadas: [chamaFerramenta] }))
    const r = await rodar(roteiro)
    expect(r.fim).toEqual({ tipo: "limite", motivo: "chamadas" })
    expect(r.run).toMatchObject({ passos: 6, status: "running" })
  })

  it("timeout do trecho: passar de 25 s de tempo ativo encerra com limite tempo", async () => {
    const r = await rodar([{ chamadas: [chamaFerramenta], demoraMs: 25_001 }])
    expect(r.fim).toEqual({ tipo: "limite", motivo: "tempo" })
    expect(r.run).toMatchObject({ passos: 1, latencia_ms: 25_001 })
  })

  it("teto de tokens: passar de 60 mil tokens encerra com limite tokens", async () => {
    const r = await rodar([
      { chamadas: [chamaFerramenta], tokens: { entrada: 30_000, saida: 30_001 } },
    ])
    expect(r.fim).toEqual({ tipo: "limite", motivo: "tokens" })
    expect(r.run).toMatchObject({ passos: 1, tokens_entrada: 30_000, tokens_saida: 30_001 })
  })
})
