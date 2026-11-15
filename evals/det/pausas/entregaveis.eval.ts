import { describe, expect, it } from "vitest"
import type { EntradaDoAcompanhante } from "@/core/agents/companion/entrada"
import { type DadosDoPreparo, preparar } from "@/core/agents/companion/preparo"
import type { MensagemDoLoop, PedidoDePasso } from "@/core/runs/agent-runtime"
import { getContainer } from "@/infra/container"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createScriptedRuntime, type PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import { cenariosComPausa, montarCenario, rodarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

const kb = getContainer().knowledge

// Jantar frio e agitada: a casa vazia deixa as refeições dependendo de perguntas.
const JANTAR: EntradaDoAcompanhante = {
  intencoes: ["momento"],
  estados: ["com_frio", "agitada"],
  evitar_da_mensagem: [],
}

// Manhã pesada: tapioca-recheada tem a tapioca como única opção da vaga base.
const MANHA = "2026-06-15T11:00:00.000Z"
const FIN: PassoRoteirizado = {
  texto: "Vou responder sem perguntar.",
  chamadas: [
    {
      nome: "finalizar",
      argumentos: {
        resposta: "Escolha algo leve e morno, e coma sentada, sem tela.",
        explicacao: { qualidades_do_momento: ["pesado"], qualidades_buscadas: ["leve"] },
        sugestoes: [],
        evitar: [],
        incertos: ["Não sei o que há na sua casa."],
        citados: [],
      },
    },
  ],
}

function cenario(nome: string): CenarioDeConversa {
  const c = cenariosComPausa[nome]
  if (!c) throw new Error(`cenário com pausa ausente: ${nome}`)
  return c
}

async function montar(c: CenarioDeConversa) {
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { runtime })
  return { contaId, deps, runtime }
}

// Contexto (JSON) que vai na primeira mensagem do modelo.
function contextoDoModelo(pedidos: PedidoDePasso[]): {
  candidatos: { id: string; tipo: string; depende_de_pergunta?: boolean }[]
} {
  const primeira = pedidos[0]?.mensagens[0]
  const conteudo = primeira && primeira.papel === "pessoa" ? primeira.conteudo : ""
  const inicio = conteudo.indexOf("<contexto>") + "<contexto>".length
  const fim = conteudo.indexOf("</contexto>")
  return JSON.parse(conteudo.slice(inicio, fim))
}

// Preparo do run com a casa e as perguntas que já foram feitas (o que a entrega corta).
function preparoDo(
  deps: Awaited<ReturnType<typeof montar>>["deps"],
  contaId: string,
  entrada: EntradaDoAcompanhante,
  perguntasFeitas: number,
): Promise<DadosDoPreparo> {
  return preparar(
    { stores: deps.stores, kb, clock: deps.clock, telemetry: createMemoryTelemetry() },
    contaId,
    entrada,
    { perguntasFeitas },
  )
}

// Resultado da última chamada de ask_user que o modelo recebeu.
function ultimoResultadoDeAsk(pedidos: PedidoDePasso[]): unknown {
  const mensagens = pedidos.at(-1)?.mensagens ?? []
  const tools = mensagens.filter(
    (m): m is Extract<MensagemDoLoop, { papel: "tool" }> => m.papel === "tool",
  )
  return tools.filter((m) => m.nome === "ask_user").at(-1)?.resultado
}

function refeicoesDo(dados: DadosDoPreparo) {
  return dados.candidatos.filter((c) => c.tipo === "refeicao")
}

describe("casa vazia: o modelo recebe no máximo duas refeições, ambas dependendo de pergunta", () => {
  it("a primeira mensagem do modelo traz duas refeições com depende_de_pergunta", async () => {
    const c = cenario("casa-vazia")
    const { contaId, deps, runtime } = await montar(c)

    await deps.conversation.conversar(contaId, c.mensagem)

    const refeicoes = contextoDoModelo(runtime.pedidos).candidatos.filter(
      (x) => x.tipo === "refeicao",
    )
    expect(refeicoes.length).toBeGreaterThan(0)
    expect(refeicoes.length).toBeLessThanOrEqual(2)
    expect(refeicoes.every((x) => x.depende_de_pergunta === true)).toBe(true)
  })
})

describe("item acabou em Minha casa não segura refeição", () => {
  it("com a mandioca tem, a refeição fica em casa; marcada como acabou, passa a depender de pergunta", async () => {
    const { contaId, deps } = await montar(cenario("casa-vazia"))
    await deps.stores.pantry.registrar(contaId, [{ alimento_id: "mandioca" }], "conversa")

    const comTem = await preparoDo(deps, contaId, JANTAR, 0)
    const pureComTem = comTem.candidatos.find((c) => c.id === "pure-de-raiz")
    expect(pureComTem).toBeDefined()
    expect(pureComTem?.depende_de_pergunta).toBeUndefined()

    await deps.stores.pantry.marcarAcabou(contaId, [{ alimento_id: "mandioca" }])

    const comAcabou = await preparoDo(deps, contaId, JANTAR, 0)
    expect(comAcabou.acabou).toContain("mandioca")
    expect(comAcabou.casa.confirmados).not.toContain("mandioca")
    const pureComAcabou = comAcabou.candidatos.find((c) => c.id === "pure-de-raiz")
    expect(pureComAcabou?.depende_de_pergunta).toBe(true)
  })
})

describe("sem pergunta disponível, nenhuma refeição é perguntável", () => {
  it("com perguntasFeitas 2, a casa vazia não leva refeição nenhuma que dependa de pergunta", async () => {
    const { contaId, deps } = await montar(cenario("casa-vazia"))

    const dados = await preparoDo(deps, contaId, JANTAR, 2)

    expect(refeicoesDo(dados).filter((c) => c.depende_de_pergunta)).toEqual([])
    expect(refeicoesDo(dados)).toEqual([])
  })
})

describe("Não tenho na única opção de uma vaga obrigatória tira a refeição", () => {
  // Pergunta de casa com a tapioca, a única opção da vaga base de tapioca-recheada.
  const tapioca: CenarioDeConversa = {
    ...cenario("casa-vazia"),
    agora: MANHA,
    mensagem: { texto: "estou pesada de manhã, o que como no café?", atalhos: [] },
    interpretacao: {
      intencoes: ["momento"],
      estados: ["pesada"],
      itens_casa: [],
      evitar_sempre: [],
      nao_come: [],
      gosta: [],
      restricoes: [],
      suspeito: false,
    },
    respostas: [{ tipo: "casa", itens: [{ alimento_id: "tapioca", resposta: "nao_tenho" }] }],
    roteiro: [
      {
        texto: "Vou confirmar a tapioca com a pessoa.",
        chamadas: [{ nome: "ask_user", argumentos: { tipo: "casa", alimentos: ["tapioca"] } }],
      },
      FIN,
    ],
  }

  it("o resultado de ask_user traz o id da refeição retirada em candidatos_retirados", async () => {
    const { contaId, deps, runtime } = await montar(tapioca)

    const rodada = await rodarCenario(deps, contaId, tapioca)

    expect(rodada.perguntas).toHaveLength(1)
    expect(contextoDoModelo(runtime.pedidos).candidatos.map((x) => x.id)).toContain(
      "tapioca-recheada",
    )
    expect(rodada.final.status).toBe("done")
    expect(ultimoResultadoDeAsk(runtime.pedidos)).toMatchObject({
      candidatos_retirados: ["tapioca-recheada"],
    })
  })
})

describe("faltas do run contam sobre a lista completa de candidatos", () => {
  it("cortar refeições na entrega não muda candidatos_completos nem faltas_do_run", async () => {
    const { contaId, deps } = await montar(cenario("casa-vazia"))

    const semCorte = await preparoDo(deps, contaId, JANTAR, 0)
    const comCorte = await preparoDo(deps, contaId, JANTAR, 2)

    expect(refeicoesDo(comCorte).length).toBeLessThan(refeicoesDo(semCorte).length)
    expect(comCorte.candidatos_completos).toContain("pure-de-raiz")
    expect(comCorte.candidatos_completos).toEqual(semCorte.candidatos_completos)
    expect(semCorte.faltas_do_run.length).toBeGreaterThan(0)
    expect(comCorte.faltas_do_run).toEqual(semCorte.faltas_do_run)
  })
})
