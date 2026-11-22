import { describe, expect, it } from "vitest"
import type { PedidoDePergunta } from "@/core/agents/tools/ask-user"
import type { PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { cenariosComPausa, montarCenario, rodarCenario } from "../../../test/fixtures/cenarios"
import type { Cenario, CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Limite de perguntas por run (config.pausas.maxPerguntasPorRun = 2) e de itens por pergunta (5).
function cenario(nome: string): CenarioDeConversa {
  const c = cenariosComPausa[nome]
  if (!c) throw new Error(`cenário com pausa ausente: ${nome}`)
  return c
}

const ENTREGA = {
  resposta: "Respire devagar por um minuto. Se puder, sente-se para comer, sem tela.",
  sugestoes: [],
  // Sem sugestão, a entrega precisa registrar um incerto quando há candidatos no momento.
  incertos: ["Não sei o que há na sua casa."],
}
const fin = (): PassoRoteirizado => ({
  texto: "Vou responder sem perguntar.",
  chamadas: [{ nome: "finalizar", argumentos: ENTREGA }],
})
const pede = (argumentos: PedidoDePergunta): PassoRoteirizado => ({
  texto: "Vou perguntar à pessoa.",
  chamadas: [{ nome: "ask_user", argumentos }],
})
const casa = (ids: string[]): PedidoDePergunta => ({ tipo: "casa", alimentos: ids })

// Resultado da última chamada de ask_user que o modelo recebeu.
function resultadoDoAsk(ultimo: unknown): unknown {
  const mensagens = (ultimo ?? []) as { papel?: string; nome?: string; resultado?: unknown }[]
  return mensagens.filter((m) => m.papel === "tool" && m.nome === "ask_user").at(-1)?.resultado
}

async function rodar(c: Cenario) {
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { runtime })
  const rodada = await rodarCenario(deps, contaId, c)
  return { rodada, resultado: resultadoDoAsk(runtime.pedidos.at(-1)?.mensagens) }
}

describe("limite de perguntas: a terceira pergunta não pausa", () => {
  it("a 3ª pergunta do agente é recusada com limite_de_perguntas e o run segue até o fim", async () => {
    const c: CenarioDeConversa = {
      ...cenario("casa-vazia"),
      respostas: [],
      roteiro: [pede(casa(["mandioca"])), pede(casa(["inhame"])), pede(casa(["ghee"])), fin()],
    }
    const { rodada, resultado } = await rodar(c)

    expect(rodada.perguntas).toHaveLength(2)
    expect(resultado).toEqual({ perguntou: false, motivo: "limite_de_perguntas" })
    expect(rodada.final.status).toBe("done")
    expect(rodada.final.saida).toBeDefined()
  })
})

describe("limite de perguntas: a variante conta como uma pergunta", () => {
  it("pausa de código com a variante e duas do agente: a 2ª do agente é recusada", async () => {
    // Com incômodo, a entrega evita a variante dita, como o modelo faria.
    const entregaDoIncomodo: PassoRoteirizado = {
      texto: "Vou responder sem perguntar.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            ...ENTREGA,
          },
        },
      ],
    }
    const c: CenarioDeConversa = {
      ...cenario("dor-de-cabeca"),
      respostas: [{ tipo: "variante", variante: "latejante" }, { tipo: "pular" }],
      roteiro: [pede(casa(["cenoura"])), pede(casa(["azeite"])), entregaDoIncomodo],
    }
    const { rodada, resultado } = await rodar(c)

    expect(rodada.perguntas.map((p) => p.pergunta.tipo)).toEqual(["variante", "casa"])
    expect(resultado).toEqual({ perguntou: false, motivo: "limite_de_perguntas" })
    expect(rodada.final.status).toBe("done")
  })
})

describe("limite de itens: mais de cinco alimentos numa pergunta", () => {
  it("seis alimentos numa pergunta de casa são recusados com muitos_itens e o run não pausa", async () => {
    const c: CenarioDeConversa = {
      ...cenario("casa-vazia"),
      respostas: [],
      roteiro: [
        pede(casa(["mandioca", "batata-doce", "inhame", "ghee", "azeite", "gengibre"])),
        fin(),
      ],
    }
    const { rodada, resultado } = await rodar(c)

    expect(rodada.perguntas).toHaveLength(0)
    expect(resultado).toEqual({ perguntou: false, motivo: "muitos_itens" })
    expect(rodada.final.status).toBe("done")
  })
})
