import { llmCotas } from "@config/llm-cotas"
import { describe, expect, it } from "vitest"
import { createMemoryAgent } from "@/core/agents/memory/memoria"
import { createModelRouter } from "@/core/llm/router"
import { createRoutine } from "@/core/routine"
import { getContainer } from "@/infra/container"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger, createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"

// Notas pela pessoa: apagar e corrigir refazem o resumo no mesmo pedido, e cada entrada inválida vira nota_invalida sem mudar nada.
const kb = getContainer().knowledge
const AGORA = "2026-06-15T22:00:00.000Z"
const ALMOCO = "almoço fora"
const TRABALHO = "trabalho em casa"
const CAMINHADA = "caminhada de manhã"

// Uma montagem: stores em memória, a Memória real sobre o papel apoio com as respostas dadas, e a rotina.
function montar(respostas: unknown[] = []) {
  const clock = createFixedClock(AGORA)
  const stores = createMemoryStores(clock, { alimentoExiste: (id) => Boolean(kb.alimento(id)) })
  const telemetry = createMemoryTelemetry()
  const ledger = createMemoryLedger(clock)
  const router = createModelRouter({ ledger, clock, telemetry })
  const client = createFakeLlm(respostas)
  const memory = createMemoryAgent({ router, client, kb, telemetry, clock })
  const rotina = createRoutine({ stores, tx: stores, memory, kb, telemetry })
  return { stores, rotina, client, telemetry }
}

function incomodoDaBase(): string {
  const palavra = kb.incomodos.find((i) => i.id === "dor-de-cabeca")?.palavras[0]
  if (!palavra) throw new Error("base sem a palavra de incômodo do eval")
  return palavra
}

describe("apagar uma nota pela pessoa", () => {
  it("tira a nota das ativas e o resumo novo, gravado no mesmo pedido, não a traz", async () => {
    // Com duas notas restantes o resumo passa pela Memória: o pedido é o que prova que a nota apagada saiu.
    const m = montar([{ resumo: "Você trabalha em casa e caminha de manhã." }])
    const almoco = await m.stores.routine.anotar("c1", ALMOCO)
    await m.stores.routine.anotar("c1", TRABALHO)
    await m.stores.routine.anotar("c1", CAMINHADA)

    await m.rotina.apagarNota("c1", almoco.id)

    expect((await m.stores.routine.notasAtivas("c1")).map((n) => n.texto)).toEqual([
      TRABALHO,
      CAMINHADA,
    ])
    expect(await m.stores.routine.resumo("c1")).toMatchObject({
      versao: 1,
      texto: "Você trabalha em casa e caminha de manhã.",
    })
    const [pedido] = m.client.pedidos as { entrada: string }[]
    expect(pedido?.entrada).not.toContain(ALMOCO)
  })

  it("apagar a última nota grava o resumo vazio (versão seguinte)", async () => {
    const m = montar()
    const almoco = await m.stores.routine.anotar("c1", ALMOCO)
    const trabalho = await m.stores.routine.anotar("c1", TRABALHO)
    await m.rotina.apagarNota("c1", almoco.id)
    expect(await m.stores.routine.resumo("c1")).toMatchObject({
      versao: 1,
      texto: "Trabalho em casa.",
    })

    await m.rotina.apagarNota("c1", trabalho.id)

    expect(await m.stores.routine.resumo("c1")).toMatchObject({ versao: 2, texto: "" })
    expect(m.client.pedidos).toHaveLength(0)
  })

  it.each([
    ["id inexistente", "nao-existe"],
    ["nota de outra conta", "daOutra"],
    ["nota já desativada", "desativada"],
  ])("%s → nota_invalida e nada muda", async (_nome, alvo) => {
    const m = montar()
    const minha = await m.stores.routine.anotar("c1", ALMOCO)
    const daOutra = await m.stores.routine.anotar("c2", "jantar cedo")
    const desativada = await m.stores.routine.anotar("c1", TRABALHO)
    await m.stores.routine.desativar("c1", desativada.id)
    const id = alvo === "daOutra" ? daOutra.id : alvo === "desativada" ? desativada.id : alvo

    await expect(m.rotina.apagarNota("c1", id)).rejects.toMatchObject({
      code: "nota_invalida",
    })
    expect((await m.stores.routine.notasAtivas("c1")).map((n) => n.id)).toEqual([minha.id])
    expect(await m.stores.routine.resumo("c1")).toBeUndefined()
  })
})

describe("corrigir uma nota pela pessoa", () => {
  it("troca o texto: a nota ativa passa a ser a nova e o resumo a traz", async () => {
    const m = montar()
    const nota = await m.stores.routine.anotar("c1", ALMOCO)

    const nova = await m.rotina.corrigirNota("c1", nota.id, "almoço fora no sábado")

    expect(nova).toMatchObject({ conta_id: "c1", texto: "almoço fora no sábado", ativa: true })
    expect((await m.stores.routine.notasAtivas("c1")).map((n) => n.texto)).toEqual([
      "almoço fora no sábado",
    ])
    expect((await m.stores.routine.resumo("c1"))?.texto).toBe("Almoço fora no sábado.")
  })

  it.each([
    ["vazio", ""],
    ["só espaços", "   "],
    ["com 201 caracteres", "a".repeat(201)],
    ["com palavra de incômodo", `tenho ${incomodoDaBase()} todo dia`],
  ])("texto %s → nota_invalida e nada muda", async (_nome, texto) => {
    const m = montar()
    const nota = await m.stores.routine.anotar("c1", ALMOCO)

    await expect(m.rotina.corrigirNota("c1", nota.id, texto)).rejects.toMatchObject({
      code: "nota_invalida",
    })
    expect((await m.stores.routine.notasAtivas("c1")).map((n) => n.id)).toEqual([nota.id])
    expect(await m.stores.routine.resumo("c1")).toBeUndefined()
  })

  it("aceita exatamente 200 caracteres", async () => {
    const m = montar()
    const nota = await m.stores.routine.anotar("c1", ALMOCO)
    const texto = "a".repeat(200)

    expect((await m.rotina.corrigirNota("c1", nota.id, texto)).texto).toBe(texto)
  })

  it.each([
    ["id inexistente", "nao-existe"],
    ["nota de outra conta", "daOutra"],
    ["nota já desativada", "desativada"],
  ])("%s → nota_invalida e nada muda", async (_nome, alvo) => {
    const m = montar()
    const minha = await m.stores.routine.anotar("c1", ALMOCO)
    const daOutra = await m.stores.routine.anotar("c2", "jantar cedo")
    const desativada = await m.stores.routine.anotar("c1", TRABALHO)
    await m.stores.routine.desativar("c1", desativada.id)
    const id = alvo === "daOutra" ? daOutra.id : alvo === "desativada" ? desativada.id : alvo

    await expect(m.rotina.corrigirNota("c1", id, "almoço leve")).rejects.toMatchObject({
      code: "nota_invalida",
    })
    expect((await m.stores.routine.notasAtivas("c1")).map((n) => n.id)).toEqual([minha.id])
    expect(await m.stores.routine.resumo("c1")).toBeUndefined()
  })

  it("com a Memória sem modelo, a correção termina e o resumo sai pelo código", async () => {
    const zero = { rpm: 0, tpm: 0, rpd: 0 }
    const limites = Object.fromEntries(llmCotas.papeis.apoio.map((modelo) => [modelo, zero]))
    const clock = createFixedClock(AGORA)
    const stores = createMemoryStores(clock, { alimentoExiste: (id) => Boolean(kb.alimento(id)) })
    const telemetry = createMemoryTelemetry()
    const ledger = createMemoryLedger(clock, limites)
    const router = createModelRouter({ ledger, clock, telemetry })
    const client = createFakeLlm([])
    const memory = createMemoryAgent({ router, client, kb, telemetry, clock })
    const rotina = createRoutine({ stores, tx: stores, memory, kb, telemetry })
    await stores.routine.anotar("c1", TRABALHO)
    const almoco = await stores.routine.anotar("c1", ALMOCO)

    await rotina.corrigirNota("c1", almoco.id, "almoço leve")

    expect(client.pedidos).toHaveLength(0)
    expect((await stores.routine.resumo("c1"))?.texto).toBe("Almoço leve. Trabalho em casa.")
  })
})
