import { describe, expect, it } from "vitest"
import { acompanhanteV8 } from "@/core/agents/prompts/acompanhante.v8"
import { createModelRouter } from "@/core/llm/router"
import { createRunService } from "@/core/runs/run-service"
import { createApprovingJudge } from "@/infra/fakes/fake-judge"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger, createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { criarAcompanhante } from "./agente"
import { createCompanion } from "./responder"

describe("criarAcompanhante", () => {
  it("tem as nove tools de leitura, as duas de proposta e resultado.registrar por último, e o controle é finalizar e ask_user, nessa ordem", () => {
    const a = criarAcompanhante()

    expect(a.nome).toBe("acompanhante")
    expect(a.tools).toHaveLength(12)
    expect(new Set(a.tools.map((t) => t.name)).size).toBe(12)
    expect(a.tools.slice(-3).map((t) => t.name)).toEqual([
      "memoria.propor",
      "lista.propor",
      "resultado.registrar",
    ])
    expect(a.controle.map((c) => c.name)).toEqual(["finalizar", "ask_user"])
    expect(a.prompt_versao).toBe(acompanhanteV8.versao)
    expect(a.instrucoes).toBe(acompanhanteV8.instrucoes)
    expect(a.lembreteDeEntrega).toBe(acompanhanteV8.lembreteDeEntrega)
  })
})

describe("resultado.registrar e finalizar no mesmo passo", () => {
  it("o retorno fecha com origem conversa antes da entrega", async () => {
    const clock = createFixedClock("2026-11-15T18:00:00.000Z")
    const stores = createMemoryStores(clock)
    const telemetry = createMemoryTelemetry()
    const kb = createMiniKnowledge()
    const conta = await stores.accounts.criar({ tipo: "demo" })
    const [pendente] = await stores.outcomes.criar(conta.id, "run-antigo", [
      {
        tipo: "cha",
        preparo_id: "cha-gengibre",
        alimentos: ["gengibre"],
        titulo: "Chá de gengibre",
      },
    ])
    if (!pendente) throw new Error("retorno não criado")
    const entrega = {
      resposta: "Que bom que ajudou.",
      explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
      sugestoes: [],
      evitar: [],
      incertos: [],
      citados: [],
    }
    const runtime = createScriptedRuntime(
      [
        {
          chamadas: [
            { nome: "resultado.registrar", argumentos: { pendente: 1 } },
            { nome: "finalizar", argumentos: entrega },
          ],
        },
      ],
      clock,
    )
    const runs = createRunService({ stores, tx: stores, runtime, clock, telemetry })
    const router = createModelRouter({ ledger: createMemoryLedger(clock), clock, telemetry })
    const companion = createCompanion({
      stores,
      tx: stores,
      kb,
      clock,
      weather: createFakeWeather(),
      router,
      runs,
      telemetry,
      judge: createApprovingJudge(),
    })

    const r = await companion.responder(conta.id, {
      intencoes: ["retorno"],
      estados: [],
      evitar_da_mensagem: [],
      retorno: { resultado: "ajudou", registrado: false },
    })

    expect(r).toMatchObject({ status: "done", fim: "entregue" })
    expect(await stores.outcomes.pendentes(conta.id)).toHaveLength(0)
    const [fechado] = await stores.outcomes.doRun(conta.id, "run-antigo")
    expect(fechado).toMatchObject({ resultado: "ajudou", origem: "conversa" })
    const etapas = await stores.runs.etapas(conta.id, r.run_id)
    const registro = etapas.find((e) => e.tipo === "tool" && e.nome === "resultado.registrar")
    const validacao = etapas.find((e) => e.tipo === "validacao" && e.nome === "finalizar")
    expect(registro).toBeDefined()
    expect(validacao).toBeDefined()
    expect(registro?.ordem).toBeLessThan(validacao?.ordem ?? 0)
  })
})
