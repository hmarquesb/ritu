import { describe, expect, it } from "vitest"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { lerConversaDoDia, mensagensParaOPrompt } from "./para-o-prompt"
import type { Mensagem } from "./ports"

const DIA = "2026-11-15"
const CONTA = "conta-1"

function mensagem(id: string, autor: "pessoa" | "agente", runId: string | null): Mensagem {
  return {
    id,
    conta_id: CONTA,
    run_id: runId,
    autor,
    texto: `texto ${id}`,
    com_incomodo: false,
    dia: DIA,
    criado_em: "2026-11-15T10:00:00.000Z",
  }
}

describe("mensagensParaOPrompt", () => {
  const runs = [
    { id: "r-acomp", caminho: "acompanhante" as const },
    { id: "r-casa", caminho: "casa" as const },
    { id: "r-alerta", caminho: "alerta" as const },
    { id: "r-fora", caminho: "fora" as const },
    { id: "r-ofensa", caminho: "ofensa" as const },
    { id: "r-atual", caminho: "acompanhante" as const },
  ]

  it("tira a run atual e as de caminho alerta, fora e ofensa", () => {
    const mensagens = [
      mensagem("1", "pessoa", "r-acomp"),
      mensagem("2", "agente", "r-acomp"),
      mensagem("3", "pessoa", "r-alerta"),
      mensagem("4", "pessoa", "r-fora"),
      mensagem("5", "pessoa", "r-ofensa"),
      mensagem("6", "pessoa", "r-casa"),
      mensagem("7", "pessoa", "r-atual"),
      mensagem("8", "pessoa", null),
    ]
    const saida = mensagensParaOPrompt({
      mensagens,
      runs,
      runAtualId: "r-atual",
      limite: 50,
    })
    expect(saida).toEqual([
      { autor: "pessoa", texto: "texto 1" },
      { autor: "agente", texto: "texto 2" },
      { autor: "pessoa", texto: "texto 6" },
      { autor: "pessoa", texto: "texto 8" },
    ])
  })

  it("mantém mensagens de run que não está na lista", () => {
    const saida = mensagensParaOPrompt({
      mensagens: [mensagem("1", "pessoa", "r-desconhecido")],
      runs: [],
      runAtualId: "r-atual",
      limite: 10,
    })
    expect(saida).toEqual([{ autor: "pessoa", texto: "texto 1" }])
  })

  it("respeita o limite pegando as últimas, em ordem", () => {
    const mensagens = [
      mensagem("1", "pessoa", null),
      mensagem("2", "agente", null),
      mensagem("3", "pessoa", null),
    ]
    const saida = mensagensParaOPrompt({ mensagens, runs: [], runAtualId: "r-atual", limite: 2 })
    expect(saida.map((m) => m.texto)).toEqual(["texto 2", "texto 3"])
  })

  it("com limite zero devolve lista vazia", () => {
    const saida = mensagensParaOPrompt({
      mensagens: [mensagem("1", "pessoa", null)],
      runs: [],
      runAtualId: "r-atual",
      limite: 0,
    })
    expect(saida).toEqual([])
  })
})

describe("lerConversaDoDia", () => {
  it("lê as mensagens do dia e aplica a exclusão, sem excluir run de outro dia", async () => {
    const clock = createFixedClock("2026-11-15T12:00:00.000Z")
    const stores = createMemoryStores(clock)
    const contaId = CONTA

    const criarDone = async (caminho: "fora" | "ofensa" | "acompanhante", dia: string) => {
      const run = await stores.runs.criar(contaId, { caminho, intencoes: [], dia })
      await stores.runs.atualizar(contaId, run.id, { status: "done" })
      return run
    }

    const runFora = await criarDone("fora", DIA)
    const runOntem = await criarDone("ofensa", "2026-11-14")
    const runAcomp = await criarDone("acompanhante", DIA)
    const runAtual = await stores.runs.criar(contaId, {
      caminho: "acompanhante",
      intencoes: [],
      dia: DIA,
    })

    await stores.messages.gravar(contaId, {
      run_id: runFora.id,
      autor: "pessoa",
      texto: "a",
      com_incomodo: false,
      dia: DIA,
    })
    await stores.messages.gravar(contaId, {
      run_id: runOntem.id,
      autor: "pessoa",
      texto: "b",
      com_incomodo: false,
      dia: DIA,
    })
    await stores.messages.gravar(contaId, {
      run_id: runAcomp.id,
      autor: "agente",
      texto: "c",
      com_incomodo: false,
      dia: DIA,
    })
    await stores.messages.gravar(contaId, {
      run_id: runAtual.id,
      autor: "pessoa",
      texto: "d",
      com_incomodo: false,
      dia: DIA,
    })
    await stores.messages.gravar(contaId, {
      autor: "pessoa",
      texto: "e",
      com_incomodo: false,
      dia: DIA,
    })

    const saida = await lerConversaDoDia(stores, {
      contaId,
      dia: DIA,
      agora: clock.now(),
      runAtualId: runAtual.id,
      limite: 50,
    })

    expect(saida).toEqual([
      { autor: "pessoa", texto: "b" },
      { autor: "agente", texto: "c" },
      { autor: "pessoa", texto: "e" },
    ])
  })
})
