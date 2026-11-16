import { describe, expect, it } from "vitest"
import { textosDoAcompanhante } from "@/core/agents/companion/textos"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import {
  cenariosDeGuardrails,
  type DepsDoCenario,
  montarCenario,
} from "../../../test/fixtures/cenarios"
import { RESPOSTA_COM_PROMESSA } from "../../../test/fixtures/cenarios/juiz-corrige"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

function cenario(nome: string): CenarioDeConversa {
  const c = cenariosDeGuardrails[nome]
  if (!c) throw new Error(`cenário de guardrail ausente: ${nome}`)
  return c
}

// Textos que o agente gravou no dia do run (a pessoa não entra aqui).
async function mensagensDoAgente(
  contaId: string,
  deps: DepsDoCenario,
  runId: string,
): Promise<string[]> {
  const run = await deps.stores.runs.buscar(contaId, runId)
  const doDia = await deps.stores.messages.doDia(contaId, run?.dia ?? "")
  return doDia.filter((m) => m.autor === "agente").map((m) => m.texto)
}

// Sem Juiz (modelo fora do ar), a entrega do agente não sai: a pessoa recebe a resposta segura.
describe("Juiz sem modelo: resposta segura, etapa juiz falhou", () => {
  const c = cenario("juiz-fora-do-ar")

  it("a entrega vira a resposta segura, a etapa juiz falha e juiz_aprovado fica nulo", async () => {
    const { contaId, deps } = await montarCenario(c)
    const resposta = await deps.conversation.conversar(contaId, c.mensagem)
    const etapas = await deps.stores.runs.etapas(contaId, resposta.run_id)
    const run = await deps.stores.runs.buscar(contaId, resposta.run_id)

    expect(resposta.saida?.origem).toBe("segura")
    expect(resposta.saida?.resposta).toBe(textosDoAcompanhante.respostaSegura)
    expect(
      etapas.filter((e) => e.tipo === "juiz").map((e) => [e.status, e.resumo, e.modelo]),
    ).toEqual([["falhou", "indisponivel", null]])
    expect(run?.juiz_tentativas).toBe(1)
    expect(run?.juiz_aprovado).toBeNull()
  })

  it("a mensagem gravada é a segura: a resposta do agente não vira mensagem", async () => {
    const { contaId, deps } = await montarCenario(c)
    const resposta = await deps.conversation.conversar(contaId, c.mensagem)

    expect(await mensagensDoAgente(contaId, deps, resposta.run_id)).toEqual([
      textosDoAcompanhante.respostaSegura,
    ])
  })
})

// Juiz com erro do modelo: o cliente é o do Intérprete; a primeira resposta é a interpretação e a segunda, o erro do Juiz.
describe("Juiz com erro do modelo: resposta segura, etapa juiz falhou", () => {
  const c = cenario("juiz-corrige")

  async function montar() {
    const llm = createFakeLlm([c.interpretacao, { erro: "indisponivel" }])
    const { contaId, deps } = await montarCenario(c, { llm })
    return { contaId, deps, llm }
  }

  it("a entrega vira a resposta segura, a etapa juiz falha e juiz_aprovado fica nulo", async () => {
    const { contaId, deps, llm } = await montar()
    const resposta = await deps.conversation.conversar(contaId, c.mensagem)
    const etapas = await deps.stores.runs.etapas(contaId, resposta.run_id)
    const run = await deps.stores.runs.buscar(contaId, resposta.run_id)

    expect(llm.pedidos).toHaveLength(2)
    expect(resposta.saida?.origem).toBe("segura")
    expect(resposta.saida?.resposta).toBe(textosDoAcompanhante.respostaSegura)
    expect(
      etapas.filter((e) => e.tipo === "juiz").map((e) => [e.status, e.resumo, e.modelo]),
    ).toEqual([["falhou", "indisponivel", null]])
    expect(run?.juiz_aprovado).toBeNull()
  })

  it("a resposta do agente (com a promessa) não vira mensagem gravada", async () => {
    const { contaId, deps } = await montar()
    const resposta = await deps.conversation.conversar(contaId, c.mensagem)
    const mensagens = await mensagensDoAgente(contaId, deps, resposta.run_id)

    expect(mensagens).toEqual([textosDoAcompanhante.respostaSegura])
    expect(mensagens).not.toContain(RESPOSTA_COM_PROMESSA)
  })
})
