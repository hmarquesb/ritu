import { llmCotas } from "@config/llm-cotas"
import { describe, expect, it } from "vitest"
import { createMemoryAgent, type MemoryAgent } from "@/core/agents/memory/memoria"
import { createModelRouter } from "@/core/llm/router"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger, createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { apagarNota, corrigirNota } from "./notas"

const CONTA = "conta-1"
const OUTRA = "conta-2"
const kb = createMiniKnowledge()

function setup(respostas: unknown[] = [], limites = {}) {
  const clock = createFixedClock("2026-06-03T20:00:00Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const ledger = createMemoryLedger(clock, limites)
  const router = createModelRouter({ ledger, clock, telemetry })
  const client = createFakeLlm(respostas)
  const memory: MemoryAgent = createMemoryAgent({ router, client, kb, telemetry, clock })
  const deps = { stores, tx: stores, memory, kb, telemetry }
  return { deps, stores, telemetry, client }
}

async function erroDe(promessa: Promise<unknown>): Promise<unknown> {
  try {
    await promessa
  } catch (erro) {
    return erro
  }
  throw new Error("devia ter falhado")
}

describe("apagarNota", () => {
  it("tira a nota das ativas e o resumo novo não a traz, no mesmo pedido", async () => {
    const { deps, stores, client } = setup([
      { resumo: "Você trabalha em casa e caminha de manhã." },
    ])
    const almoco = await stores.routine.anotar(CONTA, "almoço fora")
    await stores.routine.anotar(CONTA, "trabalho em casa")
    await stores.routine.anotar(CONTA, "caminhada de manhã")

    await apagarNota(deps, CONTA, almoco.id)

    const ativas = await stores.routine.notasAtivas(CONTA)
    expect(ativas.map((n) => n.texto)).toEqual(["trabalho em casa", "caminhada de manhã"])
    const [pedido] = client.pedidos as { entrada: string }[]
    expect(pedido?.entrada).not.toContain("almoço fora")
    expect((await stores.routine.resumo(CONTA))?.texto).toBe(
      "Você trabalha em casa e caminha de manhã.",
    )
  })

  it("apagar a última nota grava o resumo vazio", async () => {
    const { deps, stores } = setup()
    const almoco = await stores.routine.anotar(CONTA, "almoço fora")
    const trabalho = await stores.routine.anotar(CONTA, "trabalho em casa")
    await apagarNota(deps, CONTA, almoco.id)
    expect(await stores.routine.resumo(CONTA)).toMatchObject({
      versao: 1,
      texto: "Trabalho em casa.",
    })
    await apagarNota(deps, CONTA, trabalho.id)
    expect(await stores.routine.resumo(CONTA)).toMatchObject({ versao: 2, texto: "" })
  })

  it.each(["id inexistente", "nota de outra conta", "nota já desativada"])(
    "%s → nota_invalida, nada muda",
    async (alvo) => {
      const { deps, stores } = setup()
      const minha = await stores.routine.anotar(CONTA, "almoço fora")
      const daOutra = await stores.routine.anotar(OUTRA, "jantar cedo")
      const desativada = await stores.routine.anotar(CONTA, "trabalho em casa")
      await stores.routine.desativar(CONTA, desativada.id)
      const id =
        alvo === "nota de outra conta"
          ? daOutra.id
          : alvo === "nota já desativada"
            ? desativada.id
            : "nao-existe"

      expect(await erroDe(apagarNota(deps, CONTA, id))).toMatchObject({ code: "nota_invalida" })
      expect((await stores.routine.notasAtivas(CONTA)).map((n) => n.id)).toEqual([minha.id])
      expect(await stores.routine.resumo(CONTA)).toBeUndefined()
    },
  )
})

describe("corrigirNota", () => {
  it("troca o texto e o resumo, e devolve a nota nova", async () => {
    const { deps, stores } = setup()
    const nota = await stores.routine.anotar(CONTA, "almoço fora")

    const nova = await corrigirNota(deps, CONTA, nota.id, "  almoço fora no sábado  ")

    expect(nova).toMatchObject({ conta_id: CONTA, texto: "almoço fora no sábado", ativa: true })
    expect((await stores.routine.notasAtivas(CONTA)).map((n) => n.texto)).toEqual([
      "almoço fora no sábado",
    ])
    expect((await stores.routine.resumo(CONTA))?.texto).toBe("Almoço fora no sábado.")
  })

  it.each([
    ["vazio", ""],
    ["só espaços", "   "],
    ["com 201 caracteres", "a".repeat(201)],
    ["com palavra de incômodo", "tenho dor de cabeça todo dia"],
  ])("texto %s → nota_invalida e nada muda", async (_nome, texto) => {
    const { deps, stores } = setup()
    const nota = await stores.routine.anotar(CONTA, "almoço fora")

    expect(await erroDe(corrigirNota(deps, CONTA, nota.id, texto))).toMatchObject({
      code: "nota_invalida",
    })
    expect((await stores.routine.notasAtivas(CONTA)).map((n) => n.id)).toEqual([nota.id])
    expect(await stores.routine.resumo(CONTA)).toBeUndefined()
  })

  it("aceita exatamente 200 caracteres", async () => {
    const { deps, stores } = setup()
    const nota = await stores.routine.anotar(CONTA, "almoço fora")
    const texto = "a".repeat(200)
    expect((await corrigirNota(deps, CONTA, nota.id, texto)).texto).toBe(texto)
  })

  it.each([
    ["id inexistente", "nao-existe"],
    ["nota de outra conta", "outra"],
    ["nota já desativada", "desativada"],
  ])("%s → nota_invalida", async (_nome, alvo) => {
    const { deps, stores } = setup()
    const daOutra = await stores.routine.anotar(OUTRA, "jantar cedo")
    const desativada = await stores.routine.anotar(CONTA, "trabalho em casa")
    await stores.routine.desativar(CONTA, desativada.id)
    const id = alvo === "outra" ? daOutra.id : alvo === "desativada" ? desativada.id : alvo

    expect(await erroDe(corrigirNota(deps, CONTA, id, "almoço leve"))).toMatchObject({
      code: "nota_invalida",
    })
    expect(await stores.routine.notasAtivas(CONTA)).toEqual([])
  })

  it("com a Memória sem modelo, termina e o resumo é o de código", async () => {
    const zero = { rpm: 0, tpm: 0, rpd: 0 }
    const limites = Object.fromEntries(llmCotas.papeis.apoio.map((m) => [m, zero]))
    const { deps, stores, telemetry } = setup([], limites)
    await stores.routine.anotar(CONTA, "trabalho em casa")
    const almoco = await stores.routine.anotar(CONTA, "almoço fora")
    const caminhada = await stores.routine.anotar(CONTA, "caminhada de manhã")

    await corrigirNota(deps, CONTA, almoco.id, "almoço leve")
    await apagarNota(deps, CONTA, caminhada.id)

    expect(telemetry.metricas.map((m) => m.rotulos)).toEqual([
      { origem: "codigo" },
      { origem: "codigo" },
    ])
    const texto = (await stores.routine.resumo(CONTA))?.texto ?? ""
    expect(texto).toContain("Trabalho em casa")
    expect(texto).toContain("Almoço leve")
    expect(texto).not.toContain("caminhada")
  })
})
