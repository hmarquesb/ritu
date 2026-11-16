import { describe, expect, it } from "vitest"
import type { Pergunta } from "@/core/runs/pergunta"
import type { ResultadoDoRun } from "@/core/runs/run-service"
import { createRunService } from "@/core/runs/run-service"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import type { EntradaDoAcompanhante } from "./entrada"
import { criarFimDoRun } from "./fim-do-run"
import { preparar } from "./preparo"

const kb = createMiniKnowledge()

const entrada = (e: Partial<EntradaDoAcompanhante> = {}): EntradaDoAcompanhante => ({
  intencoes: ["pergunta"],
  estados: [],
  evitar_da_mensagem: [],
  ...e,
})

const perguntaDeCome: Pergunta = {
  tipo: "come",
  texto: "Você comeu arroz hoje?",
  alimento_id: "arroz",
  nome: "arroz",
}

async function montar() {
  const clock = createFixedClock("2026-11-15T18:00:00.000Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const runs = createRunService({
    stores,
    tx: stores,
    runtime: createScriptedRuntime([], clock),
    clock,
    telemetry,
  })
  const conta = await stores.accounts.criar({ tipo: "demo" })
  const fim = criarFimDoRun({ stores, kb, runs, telemetry })
  const dados = await preparar({ stores, kb, clock, telemetry }, conta.id, entrada())
  const perfil = await stores.profiles.ler(conta.id)

  // Run como o loop o deixa ao pausar: waiting_for_input.
  const aberto = await runs.iniciarRun(conta.id, {
    caminho: "acompanhante",
    intencoes: ["pergunta"],
  })
  await stores.runs.mudarStatusSe(conta.id, aberto.id, "running", "waiting_for_input")
  const run = await stores.runs.buscar(conta.id, aberto.id)
  if (!run) throw new Error("run de teste não encontrado")

  const pausa = (conteudo: unknown): ResultadoDoRun => ({
    run,
    fim: {
      tipo: "pausa",
      pendencia: { tipo: "pergunta", conteudo, criada_em: clock.now().toISOString() },
    },
  })

  return { stores, conta, fim, dados, perfil, pausa, run }
}

describe("criarFimDoRun.tratar · pausa", () => {
  it("conteúdo de pausa inválido termina em failed, com etapa pausa_invalida e saída segura", async () => {
    const m = await montar()
    const r = await m.fim.tratar(
      m.conta.id,
      m.pausa({ origem: "desconhecida" }),
      m.dados,
      m.perfil,
      {},
    )
    expect(r).toMatchObject({ status: "failed", fim: "erro", motivo: "pausa_invalida" })
    expect(r.saida?.origem).toBe("segura")
    expect(r.pergunta).toBeUndefined()

    const etapas = await m.stores.runs.etapas(m.conta.id, r.run_id)
    expect(etapas.filter((e) => e.tipo === "erro" && e.nome === "pausa_invalida")).toHaveLength(1)

    const run = await m.stores.runs.buscar(m.conta.id, r.run_id)
    expect(run?.status).toBe("failed")
    expect(run?.saida).toMatchObject({ origem: "segura" })
  })

  it("conteúdo de pausa válido fica waiting_for_input, sem saída e com a pergunta", async () => {
    const m = await montar()
    const r = await m.fim.tratar(
      m.conta.id,
      m.pausa({ origem: "agente", pergunta: perguntaDeCome }),
      m.dados,
      m.perfil,
      {},
    )
    expect(r).toMatchObject({
      status: "waiting_for_input",
      fim: "pausa",
      pergunta: perguntaDeCome,
    })
    expect(r.saida).toBeUndefined()

    const run = await m.stores.runs.buscar(m.conta.id, r.run_id)
    expect(run?.status).toBe("waiting_for_input")
  })
})

describe("criarFimDoRun.tratar · manterAberto", () => {
  it("desfecho done com o run em running só grava os campos e devolve running", async () => {
    const m = await montar()
    await m.stores.runs.mudarStatusSe(m.conta.id, m.run.id, "waiting_for_input", "running")
    const aberto = { ...m.run, status: "running" as const }
    const r = await m.fim.tratar(
      m.conta.id,
      { run: aberto, fim: { tipo: "sem_modelo" } },
      m.dados,
      m.perfil,
      {},
      true,
    )
    expect(r).toMatchObject({ status: "running", fim: "sem_modelo" })
    const salvo = await m.stores.runs.buscar(m.conta.id, m.run.id)
    expect(salvo?.status).toBe("running")
    expect(salvo?.saida).toMatchObject({ origem: "sem_modelo" })
  })
})
