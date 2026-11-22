import { describe, expect, it } from "vitest"
import { montarMensagemInicial } from "@/core/agents/companion/contexto"
import { preparar } from "@/core/agents/companion/preparo"
import { acompanhanteV8 } from "@/core/agents/prompts/acompanhante.v8"
import type { Estado } from "@/core/knowledge/vocab"
import { getContainer } from "@/infra/container"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"

// O prompt v8 só cita o que o JSON de `montarMensagemInicial` traz. Sem rede, sem banco, sem chave.

const kb = getContainer().knowledge
const CONTA = "conta-1"
// 19h em São Paulo: momento "jantar".
const JANTAR = "2026-11-15T22:00:00.000Z"

const instrucoes = acompanhanteV8.instrucoes

async function contextoDe(estados: Estado[]): Promise<Record<string, unknown>> {
  const clock = createFixedClock(JANTAR)
  const stores = createMemoryStores(clock)
  const dados = await preparar({ stores, kb, clock, telemetry: createMemoryTelemetry() }, CONTA, {
    intencoes: ["momento"],
    estados,
    evitar_da_mensagem: [],
  })
  const texto = montarMensagemInicial(dados, "estou com frio")
  const bloco = /<contexto>\n([\s\S]*?)\n<\/contexto>/.exec(texto)
  return JSON.parse(bloco?.[1] ?? "{}") as Record<string, unknown>
}

// Chaves de `momento` em todos os momentos da base (um estado, dois juntos): as citações do prompt têm onde bater.
async function chavesDoMomento(): Promise<Set<string>> {
  const chaves = new Set<string>()
  const ids = kb.estados.map((e) => e.id)
  const estados: Estado[][] = [
    [],
    ...ids.map((a) => [a]),
    ...ids.flatMap((a) => ids.map((b) => [a, b])),
  ]
  for (const e of estados) {
    const momento = (await contextoDe(e)).momento as Record<string, unknown> | undefined
    for (const chave of Object.keys(momento ?? {})) chaves.add(chave)
  }
  return chaves
}

describe("prompt v8 e o bloco de contexto", () => {
  it("não cita qualidades.* (o prompt usa momento.*)", () => {
    expect(instrucoes).not.toContain("qualidades.")
  })

  it("cada momento.* citado no prompt existe no JSON de montarMensagemInicial", async () => {
    const citados = [...instrucoes.matchAll(/momento\.([a-z_]+)/g)].map((m) => m[1] as string)
    expect(citados.length, "o prompt cita momento.*").toBeGreaterThan(0)

    const existentes = await chavesDoMomento()
    const ausentes = citados.filter((chave) => !existentes.has(chave))
    expect(ausentes).toEqual([])
  })

  it("o bloco traz o momento quando há estado", async () => {
    const contexto = await contextoDe(["com_frio"])
    expect(contexto.momento).toBeDefined()
  })
})
