import { describe, expect, it } from "vitest"
import { executarLimpeza } from "@/core/cleanup"
import { type Pergunta, textoDaResposta } from "@/core/runs/pergunta"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { cenariosComPausa, montarCenario, rodarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// 15h UTC é meio-dia no Rio, no dia seguinte ao das pausas (que começam às 19h no Rio).
const DIA_SEGUINTE = "2026-06-16T15:00:00.000Z"

function cenario(nome: string): CenarioDeConversa {
  const c = cenariosComPausa[nome]
  if (!c) throw new Error(`cenário com pausa ausente: ${nome}`)
  return c
}

async function montar(c: CenarioDeConversa) {
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { runtime })
  return { contaId, deps }
}

// Mensagens do run, na ordem em que foram gravadas.
async function mensagensDoRun(
  deps: Awaited<ReturnType<typeof montar>>["deps"],
  contaId: string,
  runId: string,
) {
  const run = await deps.stores.runs.buscar(contaId, runId)
  const doDia = await deps.stores.messages.doDia(contaId, run?.dia ?? "")
  return doDia.filter((m) => m.run_id === runId)
}

function primeiraPergunta(perguntas: { pergunta: Pergunta }[]): Pergunta {
  const pergunta = perguntas[0]?.pergunta
  if (!pergunta) throw new Error("o cenário não pausou")
  return pergunta
}

describe("mensagens: pergunta e resposta ficam gravadas com o run_id, na ordem", () => {
  it("casa-incerta grava pessoa, pergunta do agente, resposta da pessoa e saída, todas com o run_id", async () => {
    const c = cenario("casa-incerta")
    const { contaId, deps } = await montar(c)

    const rodada = await rodarCenario(deps, contaId, c)
    const pergunta = primeiraPergunta(rodada.perguntas)
    const mensagens = await mensagensDoRun(deps, contaId, rodada.final.run_id)

    expect(mensagens.map((m) => [m.autor, m.texto])).toEqual([
      ["pessoa", c.mensagem.texto],
      ["agente", pergunta.texto],
      ["pessoa", textoDaResposta(pergunta, rodada.perguntas[0]?.resposta ?? { tipo: "pular" })],
      ["agente", rodada.final.saida?.resposta],
    ])
    expect(mensagens.every((m) => m.run_id === rodada.final.run_id)).toBe(true)
  })
})

describe("mensagens: a variante fica marcada com incômodo", () => {
  it("dor-de-cabeca marca com incômodo a pergunta da variante, a resposta e a saída", async () => {
    const c: CenarioDeConversa = {
      ...cenario("dor-de-cabeca"),
      respostas: [{ tipo: "variante", variante: "latejante" }],
    }
    const { contaId, deps } = await montar(c)

    const rodada = await rodarCenario(deps, contaId, c)
    const pergunta = primeiraPergunta(rodada.perguntas)
    const mensagens = await mensagensDoRun(deps, contaId, rodada.final.run_id)

    expect(rodada.final.status).toBe("done")
    expect(mensagens.map((m) => [m.autor, m.texto])).toEqual([
      ["pessoa", c.mensagem.texto],
      ["agente", pergunta.texto],
      ["pessoa", textoDaResposta(pergunta, { tipo: "variante", variante: "latejante" })],
      ["agente", rodada.final.saida?.resposta],
    ])
    const variante = mensagens.filter((m) => m.autor === "agente" && m.texto === pergunta.texto)
    expect(variante.every((m) => m.com_incomodo)).toBe(true)
    expect(mensagens.find((m) => m.autor === "pessoa" && m.com_incomodo)).toBeDefined()
  })

  it("no dia seguinte, a limpeza apaga as mensagens da variante que já terminou", async () => {
    const c: CenarioDeConversa = {
      ...cenario("dor-de-cabeca"),
      respostas: [{ tipo: "variante", variante: "latejante" }],
    }
    const { contaId, deps } = await montar(c)
    const rodada = await rodarCenario(deps, contaId, c)
    const run = await deps.stores.runs.buscar(contaId, rodada.final.run_id)

    deps.clock.set(DIA_SEGUINTE)
    await executarLimpeza({ stores: deps.stores, clock: deps.clock, ledger: deps.ledger })

    expect(await deps.stores.messages.doDia(contaId, run?.dia ?? "")).toEqual([])
  })
})

describe("mensagens: a variante sem resposta expira, e a limpeza apaga a pergunta com incômodo", () => {
  it("com o run em espera e a limpeza no dia seguinte, o run vira expired e as mensagens com incômodo somem", async () => {
    const c: CenarioDeConversa = { ...cenario("dor-de-cabeca"), respostas: [], roteiro: [] }
    const { contaId, deps } = await montar(c)
    const r = await deps.conversation.conversar(contaId, c.mensagem)
    expect(r.status).toBe("waiting_for_input")
    const run = await deps.stores.runs.buscar(contaId, r.run_id)
    const antes = await mensagensDoRun(deps, contaId, r.run_id)
    expect(antes.map((m) => m.autor)).toEqual(["pessoa", "agente"])
    expect(antes.every((m) => m.com_incomodo)).toBe(true)

    deps.clock.set(DIA_SEGUINTE)
    await executarLimpeza({ stores: deps.stores, clock: deps.clock, ledger: deps.ledger })

    const depois = await deps.stores.runs.buscar(contaId, r.run_id)
    expect(depois?.status).toBe("expired")
    expect(await deps.stores.messages.doDia(contaId, run?.dia ?? "")).toEqual([])
  })
})
