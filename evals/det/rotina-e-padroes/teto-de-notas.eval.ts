import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import { memoriaPropor } from "@/core/agents/tools/propostas"
import { filtroVazio } from "@/core/knowledge/filtros"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import { executarProposta } from "@/core/proposals/executor"
import type { ContextoDoRun, ToolContext } from "@/core/tools/tool"
import { getContainer } from "@/infra/container"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"

// Teto de notas ativas: com o teto cheio, a rotina nova não entra (na tool e no executor); com uma a menos, entra.
const kb = getContainer().knowledge
const TETO = config.memoria.rotinaNotasAtivas
const AGORA = "2026-06-15T22:00:00.000Z"
const FATO = "Caminho cedo"

function notas(quantas: number): string[] {
  return Array.from({ length: quantas }, (_, i) => `Nota ${i}`)
}

function contextoDoRun(ativas: string[]): ContextoDoRun {
  return {
    fato_de_rotina: FATO,
    com_incomodo: false,
    tem_para_ter: false,
    nao_tem: [],
    candidatos: [],
    na_lista: [],
    lista_recusada: [],
    notas_ativas: ativas,
  }
}

function ctxDaTool(ativas: string[]): ToolContext {
  const clock = createFixedClock(AGORA)
  return {
    kb,
    filtro: filtroVazio,
    sinais: sinaisVazios,
    clima: { fonte: createFakeWeather() },
    contaId: "conta-1",
    stores: createMemoryStores(clock),
    clock,
    telemetry: createMemoryTelemetry(),
    run: contextoDoRun(ativas),
  }
}

async function contaComNotas(quantas: number) {
  const clock = createFixedClock(AGORA)
  const stores = createMemoryStores(clock, { alimentoExiste: (id) => Boolean(kb.alimento(id)) })
  const conta = await stores.accounts.criar({ tipo: "demo" })
  for (const texto of notas(quantas)) await stores.routine.anotar(conta.id, texto)
  return { stores, conta }
}

describe("teto de notas: a tool memoria.propor", () => {
  it("com o teto de notas ativas cheio, recusa com rotina_cheia", async () => {
    const resultado = await memoriaPropor.execute({ tipo: "rotina" }, ctxDaTool(notas(TETO)))

    expect(resultado).toEqual({ proposto: false, motivo: "rotina_cheia" })
  })

  it("com uma nota ativa a menos que o teto, propõe a rotina", async () => {
    const resultado = await memoriaPropor.execute({ tipo: "rotina" }, ctxDaTool(notas(TETO - 1)))

    expect(resultado).toEqual({
      proposto: true,
      proposta: { tool: "memoria.propor", tipo: "rotina", texto: FATO },
    })
  })
})

describe("teto de notas: o executor de propostas", () => {
  it("com o teto cheio, não grava a rotina e a conta segue com o mesmo número de notas", async () => {
    const { stores, conta } = await contaComNotas(TETO)

    const ok = await executarProposta(
      stores,
      conta.id,
      "memoria.propor",
      { tipo: "rotina", texto: FATO },
      kb,
    )

    expect(ok).toBe(false)
    expect(await stores.routine.notasAtivas(conta.id)).toHaveLength(TETO)
  })

  it("com uma nota a menos que o teto, grava a rotina", async () => {
    const { stores, conta } = await contaComNotas(TETO - 1)

    const ok = await executarProposta(
      stores,
      conta.id,
      "memoria.propor",
      { tipo: "rotina", texto: FATO },
      kb,
    )

    expect(ok).toBe(true)
    expect(await stores.routine.notasAtivas(conta.id)).toHaveLength(TETO)
  })
})
