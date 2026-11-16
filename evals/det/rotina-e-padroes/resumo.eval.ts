import { config } from "@config/index"
import { llmCotas } from "@config/llm-cotas"
import { describe, expect, it } from "vitest"
import { createMemoryAgent } from "@/core/agents/memory/memoria"
import { createModelRouter } from "@/core/llm/router"
import { atualizarResumo } from "@/core/routine/resumo"
import { getContainer } from "@/infra/container"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger, createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"

// Resumo da rotina: quando grava, de onde sai o texto (modelo, código ou nada) e a versão nova.
const kb = getContainer().knowledge
const AGORA = "2026-06-15T22:00:00.000Z"
const ALMOCO = "você almoça fora durante a semana"
const ACORDAR = "você acorda às 5 h às terças"

// Uma montagem: stores em memória, o papel apoio com as respostas dadas (ou esgotado), e a Memória real sobre o roteador.
async function montar(respostas: unknown[] = [], semModelo = false) {
  const clock = createFixedClock(AGORA)
  const stores = createMemoryStores(clock, { alimentoExiste: (id) => Boolean(kb.alimento(id)) })
  const telemetry = createMemoryTelemetry()
  const ledger = createMemoryLedger(clock)
  if (semModelo) {
    for (const modelo of llmCotas.papeis.apoio) {
      for (let i = 0; i < llmCotas.rateLimitsParaEsgotarODia; i++) {
        await ledger.registrarRateLimit(modelo)
      }
    }
  }
  const router = createModelRouter({ ledger, clock, telemetry })
  const client = createFakeLlm(respostas)
  const memory = createMemoryAgent({ router, client, kb, telemetry, clock })
  const conta = await stores.accounts.criar({ tipo: "demo" })
  return { clock, stores, telemetry, client, memory, conta }
}

type Montado = Awaited<ReturnType<typeof montar>>

// Anota a nota no relógio dado, para que a ordem de criação seja a que o teste quer.
async function anotar(m: Montado, texto: string, quando: string) {
  m.clock.set(quando)
  return m.stores.routine.anotar(m.conta.id, texto)
}

// O relógio volta ao AGORA antes da Memória: o apoio esgotado vale só no dia de AGORA (anotar move o relógio).
function atualizar(m: Montado) {
  m.clock.set(AGORA)
  return atualizarResumo({ stores: m.stores, memory: m.memory, telemetry: m.telemetry }, m.conta.id)
}

const DIA_1 = "2026-06-01T10:00:00.000Z"
const DIA_2 = "2026-06-02T10:00:00.000Z"
const DIA_3 = "2026-06-03T10:00:00.000Z"

function incomodoDaBase(): string {
  const palavra = kb.incomodos.find((i) => i.id === "dor-de-cabeca")?.palavras[0]
  if (!palavra) throw new Error("base sem a palavra de incômodo do eval")
  return palavra
}

describe("resumo da rotina: quando grava e de onde sai o texto", () => {
  it("sem nota, o resumo é vazio, não grava e não chama o modelo", async () => {
    const m = await montar()

    const r = await atualizar(m)

    expect(r).toMatchObject({ origem: "vazio", gravou: false })
    expect(await m.stores.routine.resumo(m.conta.id)).toBeUndefined()
    expect(m.client.pedidos).toHaveLength(0)
  })

  it("uma nota: o resumo sai direto da nota, com maiúscula e ponto, e grava a versão 1", async () => {
    const m = await montar()
    await anotar(m, ALMOCO, DIA_1)

    const r = await atualizar(m)

    expect(r).toMatchObject({ origem: "direto", gravou: true })
    expect(await m.stores.routine.resumo(m.conta.id)).toMatchObject({
      versao: 1,
      texto: "Você almoça fora durante a semana.",
    })
    expect(m.client.pedidos).toHaveLength(0)
  })

  it("várias notas com resumo válido do modelo: origem modelo e o texto do modelo é gravado", async () => {
    const m = await montar([{ resumo: "Você almoça fora na semana. Você acorda cedo." }])
    await anotar(m, ALMOCO, DIA_1)
    await anotar(m, ACORDAR, DIA_2)

    const r = await atualizar(m)

    expect(r).toMatchObject({ origem: "modelo", gravou: true })
    expect(await m.stores.routine.resumo(m.conta.id)).toMatchObject({
      versao: 1,
      texto: "Você almoça fora na semana. Você acorda cedo.",
    })
  })

  it("resumo vazio do modelo cai no resumo por código, com a mais recente primeiro", async () => {
    const m = await montar([{ resumo: "   " }])
    await anotar(m, ALMOCO, DIA_1)
    await anotar(m, ACORDAR, DIA_2)

    const r = await atualizar(m)

    expect(r.origem).toBe("codigo")
    expect((await m.stores.routine.resumo(m.conta.id))?.texto).toBe(
      "Você acorda às 5 h às terças. Você almoça fora durante a semana.",
    )
  })

  it("resumo do modelo acima do teto cai no resumo por código", async () => {
    const m = await montar([{ resumo: "x".repeat(config.memoria.resumoRotinaCaracteres + 1) }])
    await anotar(m, ALMOCO, DIA_1)
    await anotar(m, ACORDAR, DIA_2)

    const r = await atualizar(m)

    expect(r.origem).toBe("codigo")
    expect((await m.stores.routine.resumo(m.conta.id))?.texto).toBe(
      "Você acorda às 5 h às terças. Você almoça fora durante a semana.",
    )
  })

  it("resumo do modelo com palavra de incômodo cai no resumo por código", async () => {
    const m = await montar([{ resumo: `Você tem ${incomodoDaBase()} com frequência.` }])
    await anotar(m, ALMOCO, DIA_1)
    await anotar(m, ACORDAR, DIA_2)

    const r = await atualizar(m)

    expect(r.origem).toBe("codigo")
    expect((await m.stores.routine.resumo(m.conta.id))?.texto).toBe(
      "Você acorda às 5 h às terças. Você almoça fora durante a semana.",
    )
  })

  it("sem modelo no dia, o resumo sai pelo código e o modelo nem é chamado", async () => {
    const m = await montar([], true)
    await anotar(m, ALMOCO, DIA_1)
    await anotar(m, ACORDAR, DIA_2)

    const r = await atualizar(m)

    expect(r.origem).toBe("codigo")
    expect((await m.stores.routine.resumo(m.conta.id))?.texto).toBe(
      "Você acorda às 5 h às terças. Você almoça fora durante a semana.",
    )
    expect(m.client.pedidos).toHaveLength(0)
  })

  it("resumo igual ao gravado não grava de novo", async () => {
    const texto = "Você almoça fora na semana. Você acorda cedo."
    const m = await montar([{ resumo: texto }, { resumo: texto }])
    await anotar(m, ALMOCO, DIA_1)
    await anotar(m, ACORDAR, DIA_2)

    const primeira = await atualizar(m)
    const segunda = await atualizar(m)

    expect(primeira.gravou).toBe(true)
    expect(segunda).toMatchObject({ origem: "modelo", gravou: false })
    expect(await m.stores.routine.resumo(m.conta.id)).toMatchObject({ versao: 1, texto })
  })

  it("uma mudança na rotina grava a versão seguinte (a 2), e o resumo novo é o que fica", async () => {
    const m = await montar([
      { resumo: "Você almoça fora na semana." },
      { resumo: "Você almoça em casa na semana." },
    ])
    await anotar(m, ALMOCO, DIA_1)
    await anotar(m, ACORDAR, DIA_2)
    await atualizar(m)

    await anotar(m, "você dorme cedo", DIA_3)
    const r = await atualizar(m)

    expect(r.gravou).toBe(true)
    expect(await m.stores.routine.resumo(m.conta.id)).toMatchObject({
      versao: 2,
      texto: "Você almoça em casa na semana.",
    })
  })
})
