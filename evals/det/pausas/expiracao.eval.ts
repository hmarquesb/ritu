import { describe, expect, it } from "vitest"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createScriptedRuntime, type PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import { cenariosComPausa, montarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

const DIA = "2026-06-15"
const DESDE = "2000-01-01"
const MINUTO = 60_000

function cenario(nome: string): CenarioDeConversa {
  const c = cenariosComPausa[nome]
  if (!c) throw new Error(`cenário com pausa ausente: ${nome}`)
  return c
}

async function montar(c: CenarioDeConversa, llm?: ReturnType<typeof createFakeLlm>) {
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { runtime, llm })
  return { contaId, deps, runtime }
}

function primeiraResposta(c: CenarioDeConversa) {
  const resposta = c.respostas?.[0]
  if (!resposta) throw new Error(`cenário ${c.nome} sem resposta da primeira pausa`)
  return resposta
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

describe("pergunta com até 30 minutos: a resposta vale", () => {
  it("continuar com 30 minutos de espera termina o run", async () => {
    const c = cenario("casa-incerta")
    const { contaId, deps } = await montar(c)
    const r = await deps.conversation.conversar(contaId, c.mensagem)

    deps.clock.advance(30 * MINUTO)
    const final = await deps.conversation.continuar(contaId, r.run_id, primeiraResposta(c))

    expect(final.status).toBe("done")
  })
})

describe("pergunta com mais de 30 minutos: expirada, sem gravar nada", () => {
  it("com 31 minutos, o run vira expired, dá pergunta_expirada e não grava nada", async () => {
    const c = cenario("casa-incerta")
    const { contaId, deps } = await montar(c)
    const r = await deps.conversation.conversar(contaId, c.mensagem)
    const antes = await gravado(deps, contaId)

    deps.clock.advance(31 * MINUTO)
    await expect(
      deps.conversation.continuar(contaId, r.run_id, primeiraResposta(c)),
    ).rejects.toMatchObject({ code: "pergunta_expirada" })

    const run = await deps.stores.runs.buscar(contaId, r.run_id)
    expect(run?.status).toBe("expired")
    expect(await gravado(deps, contaId)).toBe(antes)
  })
})

// Duas perguntas do agente: a 1ª é respondida e a 2ª fica aberta.
const DUAS_PERGUNTAS: CenarioDeConversa = {
  ...cenario("casa-vazia"),
  respostas: [{ tipo: "casa", itens: [{ alimento_id: "mandioca", resposta: "tenho" }] }],
  roteiro: [
    {
      texto: "Vou conferir o que tenho em casa agora.",
      chamadas: [{ nome: "casa.ler", argumentos: {} }],
    },
    {
      texto: "Vou confirmar a mandioca com a pessoa.",
      chamadas: [{ nome: "ask_user", argumentos: { tipo: "casa", alimentos: ["mandioca"] } }],
    },
    {
      texto: "Vou confirmar o óleo de coco com a pessoa.",
      chamadas: [{ nome: "ask_user", argumentos: { tipo: "casa", alimentos: ["oleo-de-coco"] } }],
    },
    {
      texto: "Vou responder sem perguntar mais.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta: "Escolha algo morno e cozido, e coma sentada, sem tela.",
            sugestoes: [],
            incertos: ["Não sei o que há na sua casa."],
          },
        },
      ],
    },
  ] satisfies PassoRoteirizado[],
}

describe("mensagem nova com pergunta aberta cancela o run em espera", () => {
  it("o run antigo vira cancelled e a resposta já dada continua gravada", async () => {
    const interpretacao = DUAS_PERGUNTAS.interpretacao
    const llm = createFakeLlm([interpretacao, interpretacao])
    const { contaId, deps } = await montar(DUAS_PERGUNTAS, llm)

    const primeiro = await deps.conversation.conversar(contaId, DUAS_PERGUNTAS.mensagem)
    const aberto = await deps.conversation.continuar(
      contaId,
      primeiro.run_id,
      primeiraResposta(DUAS_PERGUNTAS),
    )
    expect(aberto.status).toBe("waiting_for_input")

    const nova = await deps.conversation.conversar(contaId, {
      texto: "e agora, o que como no jantar?",
      atalhos: [],
    })

    expect(nova.run_id).not.toBe(aberto.run_id)
    const antigo = await deps.stores.runs.buscar(contaId, aberto.run_id)
    expect(antigo?.status).toBe("cancelled")
    const casa = await deps.stores.pantry.listar(contaId)
    expect(casa.find((i) => i.alimento_id === "mandioca")).toMatchObject({
      estado: "tem",
      origem: "pergunta",
    })
  })
})
