import { describe, expect, it } from "vitest"
import type { PedidoDePasso } from "@/core/runs/agent-runtime"
import { createScriptedRuntime, type PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import {
  cenarios,
  cenariosComPausa,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

function cenario(nome: string): CenarioDeConversa {
  const c = cenariosComPausa[nome]
  if (!c) throw new Error(`cenário com pausa ausente: ${nome}`)
  return c
}

// Dor de cabeca com o incômodo já com a variante dada pelo Intérprete (ou sem variante, se undefined).
function comIncomodo(c: CenarioDeConversa, incomodo: { id: string; variante?: string }) {
  if (!c.interpretacao) throw new Error(`cenário ${c.nome} sem interpretação`)
  return { ...c, interpretacao: { ...c.interpretacao, incomodo } }
}

// Roteiro curto: clima e uma resposta final que evita a variante dada.
function roteiroDaVariante(): PassoRoteirizado[] {
  return [
    {
      texto: "Vou ver o clima de agora antes de responder.",
      chamadas: [{ nome: "clima.agora", argumentos: {} }],
    },
    {
      texto: "Vou responder com cuidado, pelo jeito que essa dor está.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Com essa dor de cabeça, escolha algo leve e morno e beba água aos goles. Se a dor for forte ou continuar, procure uma pessoa de saúde.",
            sugestoes: [],
            incertos: ["Não sei o que há na sua casa."],
          },
        },
      ],
    },
  ]
}

// Sem variante dita, o clima (frio, oleoso) é o do momento; a entrega busca o contrário.
function roteiroSemVariante(): PassoRoteirizado[] {
  return [
    {
      texto: "Vou ver o clima de agora antes de responder.",
      chamadas: [{ nome: "clima.agora", argumentos: {} }],
    },
    {
      texto: "Vou responder com algo leve, sem saber a variante da dor.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Escolha algo quente e seco, e beba água aos goles. Se a dor for forte ou continuar, procure uma pessoa de saúde.",
            sugestoes: [],
            incertos: ["Não sei o que há na sua casa."],
          },
        },
      ],
    },
  ]
}

async function montar(c: CenarioDeConversa) {
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { runtime })
  return { contaId, deps, runtime }
}

// Contexto (JSON) que vai na primeira mensagem do modelo.
function contextoDoModelo(pedidos: PedidoDePasso[]): {
  candidatos: { id: string }[]
  momento?: { precisa_variante?: { incomodo: string } }
} {
  const primeira = pedidos[0]?.mensagens[0]
  const conteudo = primeira && primeira.papel === "pessoa" ? primeira.conteudo : ""
  const inicio = conteudo.indexOf("<contexto>") + "<contexto>".length
  const fim = conteudo.indexOf("</contexto>")
  return JSON.parse(conteudo.slice(inicio, fim))
}

describe("variante sem resposta: a pergunta sai por código, sem pedido ao runtime", () => {
  it("dor-de-cabeca sem variante pausa antes de qualquer chamada ao runtime", async () => {
    const c = cenario("dor-de-cabeca")
    const { contaId, deps, runtime } = await montar(c)

    const r = await deps.conversation.conversar(contaId, c.mensagem)

    expect(r.status).toBe("waiting_for_input")
    expect(r.pergunta?.tipo).toBe("variante")
    expect(runtime.pedidos).toHaveLength(0)
  })
})

describe("cada variante muda os candidatos", () => {
  it("latejante, tensa e pesada dão listas de candidatos diferentes", async () => {
    const base = cenario("dor-de-cabeca")
    const listas: string[][] = []

    for (const variante of ["latejante", "tensa", "pesada"]) {
      const c: CenarioDeConversa = {
        ...comIncomodo(base, { id: "dor-de-cabeca", variante }),
        respostas: [],
        roteiro: roteiroDaVariante(),
      }
      const { contaId, deps, runtime } = await montar(c)
      await deps.conversation.conversar(contaId, c.mensagem)
      listas.push(contextoDoModelo(runtime.pedidos).candidatos.map((x) => x.id))
    }

    expect(new Set(listas.map((l) => l.join("|"))).size).toBe(3)
  })
})

describe("pular a variante segue sem ela, com precisa_variante no contexto", () => {
  it("depois de pular, a primeira mensagem do modelo traz precisa_variante", async () => {
    const c: CenarioDeConversa = {
      ...cenario("dor-de-cabeca"),
      respostas: [{ tipo: "pular" }],
      roteiro: roteiroSemVariante(),
    }
    const { contaId, deps, runtime } = await montar(c)

    const rodada = await rodarCenario(deps, contaId, c)

    expect(rodada.perguntas.map((p) => p.pergunta.tipo)).toEqual(["variante"])
    expect(rodada.final.status).toBe("done")
    expect(contextoDoModelo(runtime.pedidos).momento?.precisa_variante).toMatchObject({
      incomodo: "dor-de-cabeca",
    })
  })
})

describe("incômodo sem pergunta de variante não pausa", () => {
  it("incômodo de variante única (estômago pesado) responde sem pausa", async () => {
    const c = cenarios["estomago-pesado"]
    if (!c) throw new Error("cenário estomago-pesado ausente")
    const { contaId, deps } = await montarCenario(c, {
      runtime: createScriptedRuntime(c.roteiro),
    })

    const rodada = await rodarCenario(deps, contaId, c)

    expect(rodada.perguntas).toHaveLength(0)
    expect(rodada.final.status).toBe("done")
  })

  it("incômodo com a variante já dita não pausa", async () => {
    const base = cenario("dor-de-cabeca")
    const c: CenarioDeConversa = {
      ...comIncomodo(base, { id: "dor-de-cabeca", variante: "latejante" }),
      respostas: [],
      roteiro: roteiroDaVariante(),
    }
    const { contaId, deps, runtime } = await montar(c)

    const rodada = await rodarCenario(deps, contaId, c)

    expect(rodada.perguntas).toHaveLength(0)
    expect(rodada.final.status).toBe("done")
    expect(runtime.pedidos.length).toBeGreaterThan(0)
  })
})
