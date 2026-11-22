import { describe, expect, it } from "vitest"
import type { PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { cenariosComPausa, montarCenario, rodarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

function cenario(nome: string): CenarioDeConversa {
  const c = cenariosComPausa[nome]
  if (!c) throw new Error(`cenário com pausa ausente: ${nome}`)
  return c
}

// Casa incerta (abóbora e couve), com a pausa de casa e a base real.
const casaIncerta = cenario("casa-incerta")

async function montar(c: CenarioDeConversa) {
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { runtime })
  return { contaId, deps, runtime }
}

function primeiraResposta(c: CenarioDeConversa) {
  const resposta = c.respostas?.[0]
  if (!resposta) throw new Error(`cenário ${c.nome} sem resposta da primeira pausa`)
  return resposta
}

function resultadoDaTool(mensagens: unknown[], nome: string): unknown {
  const tools = mensagens.filter(
    (m): m is { papel: "tool"; nome: string; resultado: unknown } =>
      typeof m === "object" &&
      m !== null &&
      "papel" in m &&
      m.papel === "tool" &&
      "nome" in m &&
      m.nome === nome,
  )
  return tools.at(-1)?.resultado
}

// Passo de entrega com uma sugestão de um alimento num preparo, como o modelo escreveria.
function entregaCom(alimento_id: string, preparo_id: string, funcao: string): PassoRoteirizado {
  return {
    texto: "Vou montar a resposta com o que você confirmou.",
    chamadas: [
      {
        nome: "finalizar",
        argumentos: {
          resposta:
            "Para um jantar frio, uma refeição morna ajuda a aquecer sem pesar. Se puder, sente-se para comer, sem tela.",
          sugestoes: [
            {
              tipo: "refeicao",
              id: preparo_id,
              escolhas: [{ funcao, alimento_id }],
              motivo: "Uma comida morna e cozida, com o que você tem em casa.",
            },
          ],
          incertos: [],
        },
      },
    ],
  }
}

describe("pausa de casa: pendência e checkpoint, sem saída", () => {
  it("casa-incerta pausa em waiting_for_input com a pergunta, a pendência do agente e o checkpoint", async () => {
    const { contaId, deps } = await montar(casaIncerta)
    const r = await deps.conversation.conversar(contaId, casaIncerta.mensagem)
    const run = await deps.stores.runs.buscar(contaId, r.run_id)

    expect(r.status).toBe("waiting_for_input")
    expect(r.pergunta?.tipo).toBe("casa")
    expect(r.saida).toBeUndefined()
    expect(run?.status).toBe("waiting_for_input")
    expect(run?.pendencia).toMatchObject({
      tipo: "pergunta",
      conteudo: { origem: "agente" },
    })
    expect(run?.checkpoint).not.toBeNull()
  })
})

describe("pausa de casa: a retomada não repete pedido ao runtime", () => {
  it("antes da pausa há dois pedidos; a retomada acrescenta só o passo seguinte", async () => {
    const { contaId, deps, runtime } = await montar(casaIncerta)
    const r = await deps.conversation.conversar(contaId, casaIncerta.mensagem)

    expect(runtime.pedidos).toHaveLength(2)

    await deps.conversation.continuar(contaId, r.run_id, primeiraResposta(casaIncerta))

    expect(runtime.pedidos).toHaveLength(3)
  })
})

describe("pausa de casa: a tool e o validador recebem os dados atualizados", () => {
  it("o resultado de ask_user que o modelo recebe traz as respostas da pessoa", async () => {
    const { contaId, deps, runtime } = await montar(casaIncerta)
    await rodarCenario(deps, contaId, casaIncerta)

    const resultado = resultadoDaTool(runtime.pedidos.at(-1)?.mensagens ?? [], "ask_user")

    expect(resultado).toMatchObject({
      respostas: [
        { alimento_id: "abobora", resposta: "tenho" },
        { alimento_id: "couve", resposta: "nao_tenho" },
      ],
    })
  })

  it("entrega com couve, que saiu de casa, é recusada; com abóbora, é aceita", async () => {
    const roteiro = [
      ...casaIncerta.roteiro.slice(0, 2),
      entregaCom("couve", "caldo", "folha"),
      entregaCom("abobora", "legumes-no-vapor", "legume"),
    ]
    const c: CenarioDeConversa = { ...casaIncerta, roteiro }
    const { contaId, deps, runtime } = await montar(c)
    const rodada = await rodarCenario(deps, contaId, c)

    const violacoes = resultadoDaTool(runtime.pedidos.at(-1)?.mensagens ?? [], "finalizar") as {
      violacoes?: { codigo: string }[]
    }

    // A escolha só pode vir das opcoes do candidato: a couve não está entre as da vaga "folha" do caldo
    // confirmadas em casa, e o caldo não tem item incerto para trocar por ela (trocas), então a
    // recusa é estrutura, e não fora_de_casa. outras violações do mesmo texto não contam aqui.
    expect(violacoes.violacoes).toContainEqual(expect.objectContaining({ codigo: "estrutura" }))
    expect(rodada.final.status).toBe("done")
    expect(rodada.final.saida?.sugestoes.flatMap((s) => s.itens.map((i) => i.alimento_id))).toEqual(
      ["abobora"],
    )
  })
})

describe("pausa de casa: o run termina", () => {
  it("casa-incerta termina done, com saída, depois da pausa", async () => {
    const { contaId, deps } = await montar(casaIncerta)
    const rodada = await rodarCenario(deps, contaId, casaIncerta)
    const run = await deps.stores.runs.buscar(contaId, rodada.final.run_id)

    expect(rodada.perguntas).toHaveLength(1)
    expect(rodada.final.status).toBe("done")
    expect(rodada.final.saida).toBeDefined()
    expect(run?.status).toBe("done")
  })
})
