import { describe, expect, it } from "vitest"
import { executarLimpeza } from "@/core/cleanup"
import { textosDaConversa } from "@/core/conversation/textos"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { montarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"
import { cenario, com } from "./apoio"

const TEXTO_EMOCIONAL = "não aguento mais, queria sumir"

// Alerta emocional com "evitar sempre" e casa na mesma saída: o alerta deve ignorar os dois.
const emocional = com(cenario("alerta-emocional"), TEXTO_EMOCIONAL, {
  intencoes: ["vida"],
  alerta: "emocional",
  evitar_sempre: ["abóbora"],
  itens_casa: [{ nome: "couve", acao: "tem" }],
})

const fisico = com(cenario("alerta-emocional"), "tenho uma dor forte no peito", {
  intencoes: ["vida"],
  alerta: "fisico",
  itens_casa: [{ nome: "couve", acao: "tem" }],
})

async function montar(c: CenarioDeConversa, respostas: unknown[]) {
  const llm = createFakeLlm(respostas)
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { llm, runtime })
  return { contaId, deps, llm, runtime }
}

describe("alerta emocional: texto fixo, sem anotação e sem nada guardado no dia", () => {
  it("devolve o texto fixo com o CVV e não anota nada", async () => {
    const { contaId, deps } = await montar(emocional, [emocional.interpretacao])
    const resposta = await deps.conversation.conversar(contaId, emocional.mensagem)

    expect(resposta.saida?.resposta).toBe(textosDaConversa.alertaEmocional)
    expect(resposta.saida?.anotacoes).toEqual([])
  })

  it("não grava nem o 'evitar sempre' nem a casa do dia", async () => {
    const { contaId, deps } = await montar(emocional, [emocional.interpretacao])
    const resposta = await deps.conversation.conversar(contaId, emocional.mensagem)
    const run = await deps.stores.runs.buscar(contaId, resposta.run_id)

    expect(await deps.stores.profiles.evitarTemporario(contaId, run?.dia ?? "")).toEqual([])
    expect(await deps.stores.pantry.listar(contaId)).toHaveLength(emocional.casa.length)
  })
})

describe("alerta físico: texto fixo do profissional, sem anotação", () => {
  it("devolve o texto fixo e não anota nada", async () => {
    const { contaId, deps } = await montar(fisico, [fisico.interpretacao])
    const resposta = await deps.conversation.conversar(contaId, fisico.mensagem)
    const run = await deps.stores.runs.buscar(contaId, resposta.run_id)

    expect(resposta.saida?.resposta).toBe(textosDaConversa.alertaFisico)
    expect(resposta.saida?.anotacoes).toEqual([])
    expect(run?.caminho).toBe("alerta")
  })
})

describe("alerta: as mensagens ficam marcadas e somem no dia seguinte", () => {
  it("pessoa e agente ficam com incômodo, fora do dia de hoje", async () => {
    const { contaId, deps } = await montar(emocional, [emocional.interpretacao])
    const resposta = await deps.conversation.conversar(contaId, emocional.mensagem)
    const run = await deps.stores.runs.buscar(contaId, resposta.run_id)
    const doDia = await deps.stores.messages.doDia(contaId, run?.dia ?? "")

    expect(doDia.map((m) => m.autor).sort()).toEqual(["agente", "pessoa"])
    expect(doDia.every((m) => m.com_incomodo)).toBe(true)
  })

  it("a limpeza do dia seguinte apaga as mensagens", async () => {
    const { contaId, deps } = await montar(emocional, [emocional.interpretacao])
    const resposta = await deps.conversation.conversar(contaId, emocional.mensagem)
    const run = await deps.stores.runs.buscar(contaId, resposta.run_id)
    const dia = run?.dia ?? ""

    // 12h em São Paulo do dia seguinte.
    deps.clock.set("2026-06-16T15:00:00.000Z")
    await executarLimpeza({ stores: deps.stores, clock: deps.clock, ledger: deps.ledger })

    expect(await deps.stores.messages.doDia(contaId, dia)).toEqual([])
  })
})

describe("alerta: a mensagem não entra no prompt da mensagem seguinte", () => {
  it("a conversa normal de antes entra no prompt; a do alerta não", async () => {
    const casa = com(cenario("casa-sozinha"), "fui à feira, trouxe abóbora, couve e pitaia", {
      intencoes: ["casa"],
      itens_casa: [{ nome: "abóbora", acao: "tem" }],
    })
    const ofensa = com(cenario("ofensa"), "você é inútil", { intencoes: ["ofensa"] })
    const { contaId, deps, llm } = await montar(casa, [
      casa.interpretacao,
      emocional.interpretacao,
      ofensa.interpretacao,
    ])

    await deps.conversation.conversar(contaId, casa.mensagem)
    await deps.conversation.conversar(contaId, emocional.mensagem)
    await deps.conversation.conversar(contaId, ofensa.mensagem)

    // Pedido 0 é do primeiro Intérprete; o pedido 2 é o da mensagem seguinte ao alerta.
    const entradas = (llm.pedidos as { entrada: string }[]).map((p) => p.entrada)
    const depoisDoAlerta = entradas[2] ?? ""
    expect(depoisDoAlerta).toContain("fui à feira")
    expect(depoisDoAlerta).not.toContain(TEXTO_EMOCIONAL)
    expect(depoisDoAlerta).not.toContain(textosDaConversa.alertaEmocional)
  })
})
