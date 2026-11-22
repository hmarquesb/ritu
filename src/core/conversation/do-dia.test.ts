import { describe, expect, it } from "vitest"
import type { DemoSeed } from "@/core/demo-seed"
import type { ModelRouter } from "@/core/llm/router"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { conversaDoDia, visaoDoRunDaConta } from "./do-dia"

const DIA = "2026-11-16"
const AGORA = "2026-11-16T15:00:00.000Z"
const ROUTER = { cotaDoDiaEsgotada: async () => false } as unknown as ModelRouter
const SEED = { mensagem_sugerida: "Quero algo leve hoje." } as unknown as DemoSeed

async function montar(tipo: "google" | "demo" = "demo") {
  const clock = createFixedClock(AGORA)
  const stores = createMemoryStores(clock)
  const conta = await stores.accounts.criar({ tipo })
  const perfil = await stores.profiles.ler(conta.id)
  return { clock, stores, conta, perfil }
}

type Montado = Awaited<ReturnType<typeof montar>>

async function rodar(m: Montado) {
  return conversaDoDia(
    {
      stores: m.stores,
      clock: m.clock,
      seed: SEED,
      limiter: createMemoryLimiter(),
      router: ROUTER,
      telemetry: createMemoryTelemetry(),
    },
    m.conta,
    m.perfil,
    { ipHash: "h" },
  )
}

async function fala(
  m: Montado,
  autor: "pessoa" | "agente",
  texto: string,
  dia = DIA,
  runId?: string,
) {
  return m.stores.messages.gravar(m.conta.id, {
    ...(runId ? { run_id: runId } : {}),
    autor,
    texto,
    com_incomodo: false,
    dia,
  })
}

async function rodada(m: Montado, status: "done" | "waiting_for_input" = "done") {
  const run = await m.stores.runs.criar(m.conta.id, {
    caminho: "acompanhante",
    intencoes: [],
    dia: DIA,
  })
  await m.stores.runs.atualizar(m.conta.id, run.id, { status })
  return run
}

describe("conversaDoDia", () => {
  it("traz só as falas do dia local e deixa de fora as de ontem", async () => {
    const m = await montar()
    await fala(m, "pessoa", "de ontem", "2026-11-15")
    await fala(m, "pessoa", "de hoje")

    const conversa = await rodar(m)

    expect(conversa.falas.map((f) => f.texto)).toEqual(["de hoje"])
  })

  it("mantém as falas na ordem em que foram ditas", async () => {
    const m = await montar()
    await fala(m, "pessoa", "primeira")
    await fala(m, "agente", "segunda")
    await fala(m, "pessoa", "terceira")

    const conversa = await rodar(m)

    expect(conversa.falas.map((f) => [f.autor, f.texto])).toEqual([
      ["pessoa", "primeira"],
      ["agente", "segunda"],
      ["pessoa", "terceira"],
    ])
  })

  it("não mostra como fala solta o texto da pergunta do agente", async () => {
    const m = await montar()
    const run = await m.stores.runs.criar(m.conta.id, {
      caminho: "acompanhante",
      intencoes: [],
      dia: DIA,
    })
    await m.stores.runs.atualizar(m.conta.id, run.id, {
      status: "waiting_for_input",
      pendencia: {
        tipo: "pergunta",
        criada_em: AGORA,
        conteudo: {
          origem: "agente",
          pergunta: {
            tipo: "come",
            texto: "Você come aveia?",
            alimento_id: "aveia",
            nome: "Aveia",
          },
        },
      },
    })
    await fala(m, "pessoa", "quero algo com cereal", DIA, run.id)
    await fala(m, "agente", "Você come aveia?", DIA, run.id)

    const conversa = await rodar(m)

    expect(conversa.falas.map((f) => f.texto)).toEqual(["quero algo com cereal"])
    expect(conversa.runs[run.id]?.pergunta?.estado).toBe("aberta")
    expect(conversa.aberto).toEqual({ run_id: run.id, status: "waiting_for_input" })
  })

  it("monta a visão de cada run com o voto da pessoa", async () => {
    const m = await montar()
    const run = await rodada(m)
    await fala(m, "pessoa", "oi", DIA, run.id)
    await fala(m, "agente", "oi, tudo bem?", DIA, run.id)
    await m.stores.runs.votar(m.conta.id, run.id, "up")

    const conversa = await rodar(m)

    expect(conversa.runs[run.id]).toMatchObject({ run_id: run.id, voto: "up", status: "done" })
  })

  it("traz o run aberto quando ele espera aprovação", async () => {
    const m = await montar()
    const run = await m.stores.runs.criar(m.conta.id, {
      caminho: "acompanhante",
      intencoes: [],
      dia: DIA,
    })
    await m.stores.runs.mudarStatusSe(m.conta.id, run.id, "running", "waiting_for_approval")

    const conversa = await rodar(m)

    expect(conversa.aberto).toEqual({ run_id: run.id, status: "waiting_for_approval" })
  })

  it("conta os retornos pendentes da conta", async () => {
    const m = await montar()
    const run = await rodada(m)
    await m.stores.outcomes.criar(m.conta.id, run.id, [
      { tipo: "cha", alimentos: ["gengibre"], titulo: "Chá de gengibre" },
    ])

    const conversa = await rodar(m)

    expect(conversa.pendentes).toBe(1)
  })

  it("sugere a mensagem só na demonstração sem fala no dia", async () => {
    const demo = await montar("demo")
    const google = await montar("google")
    const demoComFala = await montar("demo")
    await fala(demoComFala, "pessoa", "já falei hoje")

    expect((await rodar(demo)).mensagem_sugerida).toBe(SEED.mensagem_sugerida)
    expect((await rodar(google)).mensagem_sugerida).toBeUndefined()
    expect((await rodar(demoComFala)).mensagem_sugerida).toBeUndefined()
  })

  it("não traz falas nem runs de outra conta", async () => {
    const m = await montar()
    const outra = await m.stores.accounts.criar({ tipo: "demo" })
    await m.stores.messages.gravar(outra.id, {
      autor: "pessoa",
      texto: "fala de outra conta",
      com_incomodo: false,
      dia: DIA,
    })
    const run = await rodada(m)
    await m.stores.outcomes.criar(outra.id, run.id, [
      { tipo: "cha", alimentos: ["gengibre"], titulo: "Chá de gengibre" },
    ])
    await fala(m, "pessoa", "minha fala")

    const conversa = await rodar(m)

    expect(conversa.falas.map((f) => f.texto)).toEqual(["minha fala"])
    expect(conversa.pendentes).toBe(0)
  })

  it("visaoDoRunDaConta monta a visão do run com o voto dado", async () => {
    const m = await montar()
    const run = await rodada(m)

    const visao = await visaoDoRunDaConta(m.stores, m.conta.id, run, "up", m.clock.now())

    expect(visao.run_id).toBe(run.id)
    expect(visao.voto).toBe("up")
  })
})
