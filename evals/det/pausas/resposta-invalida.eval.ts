import { describe, expect, it } from "vitest"
import { RunNaoContinuavelError } from "@/core/runs/errors"
import type { RespostaDaPessoa } from "@/core/runs/pergunta"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { cenariosComPausa, montarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

const DIA = "2026-06-15"
const DESDE = "2000-01-01"

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

// Tudo que uma resposta grava: casa, gosto, faltas, lista e as mensagens do dia.
async function gravado(deps: Awaited<ReturnType<typeof montar>>["deps"], contaId: string) {
  return JSON.stringify({
    casa: await deps.stores.pantry.listar(contaId),
    gostos: await deps.stores.preferences.ler(contaId),
    faltas: await deps.stores.shortages.diasComFalta(contaId, DESDE),
    lista: await deps.stores.shortages.lista(contaId),
    mensagens: await deps.stores.messages.doDia(contaId, DIA),
  })
}

// Pausa de casa (casa-incerta) com a resposta inválida dada; a pausa segue aberta e nada é gravado.
async function responderComInvalida(nome: string, invalida: RespostaDaPessoa) {
  const c = cenario(nome)
  const { contaId, deps } = await montar(c)
  const r = await deps.conversation.conversar(contaId, c.mensagem)
  const antes = await gravado(deps, contaId)

  await expect(deps.conversation.continuar(contaId, r.run_id, invalida)).rejects.toMatchObject({
    code: "resposta_invalida",
  })

  const run = await deps.stores.runs.buscar(contaId, r.run_id)
  expect(run?.status).toBe("waiting_for_input")
  expect(await gravado(deps, contaId)).toBe(antes)
}

describe("resposta de tipo trocado é inválida", () => {
  it("responder 'come' a uma pergunta de casa dá resposta_invalida, sem gravar", async () => {
    await responderComInvalida("casa-incerta", { tipo: "come", resposta: "como" })
  })
})

describe("resposta de casa com alimento fora da pergunta é inválida", () => {
  it("cenoura não estava na pergunta (abóbora e couve): resposta_invalida, sem gravar", async () => {
    await responderComInvalida("casa-incerta", {
      tipo: "casa",
      itens: [{ alimento_id: "cenoura", resposta: "tenho" }],
    })
  })
})

describe("variante inexistente é inválida", () => {
  it("uma opção que não está no incômodo dá resposta_invalida", async () => {
    await responderComInvalida("dor-de-cabeca", { tipo: "variante", variante: "inexistente" })
  })
})

describe("run de outra conta não continua", () => {
  it("continuar com a conta de outra pessoa lança RunNaoContinuavelError", async () => {
    const c = cenario("casa-incerta")
    const { contaId, deps } = await montar(c)
    const r = await deps.conversation.conversar(contaId, c.mensagem)
    const outra = await deps.stores.accounts.criar({ tipo: "demo" })

    await expect(
      deps.conversation.continuar(outra.id, r.run_id, { tipo: "pular" }),
    ).rejects.toBeInstanceOf(RunNaoContinuavelError)

    const run = await deps.stores.runs.buscar(contaId, r.run_id)
    expect(run?.status).toBe("waiting_for_input")
    expect(await deps.stores.shortages.diasComFalta(contaId, DESDE)).toEqual([])
  })
})
