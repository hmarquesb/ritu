import { describe, expect, it, vi } from "vitest"

// Limite de perguntas por run alto só neste arquivo: o teste de pausas acima do teto precisa de quatro pausas.
vi.mock("../../../config/pausas", () => ({
  pausas: { maxPerguntasPorRun: 10, maxItensPorPergunta: 5, maxRefeicoesAPerguntar: 2 },
}))

import { casosC1 } from "../../../evals/llm/casos/c1"
import type { CasoConversa } from "../../../evals/llm/casos/c2"
import { tenhoATudo } from "../../../evals/llm/casos/c2/perguntas/expectativas"
import type { Pergunta, RespostaDaPessoa } from "../../../src/core/runs/pergunta"
import type { RunEtapa } from "../../../src/core/runs/ports"
import { createFakeLlm } from "../../../src/infra/fakes/fake-llm"
import {
  createScriptedRuntime,
  type PassoRoteirizado,
} from "../../../src/infra/fakes/scripted-runtime"
import {
  cenariosComPausa,
  cenariosDeAprendizado,
  cenariosDeConversa,
  cenariosDeGuardrails,
} from "../../../test/fixtures/cenarios"
import { MAXIMO_DE_RETOMADAS } from "../../../test/fixtures/cenarios/rodar"
import { motivosDoJuizDasEtapas } from "../demo-report"
import { cenarioDoRunner, resolverResposta } from "./colher"
import { rodarAcompanhante, rodarConversa } from "./rodar-run"

const AGORA = "2026-06-15T22:00:00.000Z"

const soAtalhos = cenariosDeConversa["so-atalhos"]
if (!soAtalhos) throw new Error("cenário so-atalhos ausente")

const casoConversa: CasoConversa = {
  tipo: "conversa",
  familias: ["conversa"],
  id: "t-conversa",
  titulo: "Só atalhos",
  cenario: soAtalhos,
  deve: [
    {
      descricao: "responde como agente",
      confere: ({ resultado }) => resultado.saida.origem === "agente",
    },
  ],
  naoPode: [
    {
      descricao: "não sai sem modelo",
      confere: ({ resposta }) => resposta.saida?.origem !== "sem_modelo",
    },
  ],
}

describe("runner da conversa com LLM falso", () => {
  it("leva o juiz do run e o caminho do run para o resultado", async () => {
    const { resultado } = await rodarConversa(casoConversa, {
      runtime: createScriptedRuntime(soAtalhos.roteiro),
      llm: createFakeLlm([{ apontamentos: [] }]),
    })

    expect(resultado.run?.juizAprovado).toBe(true)
    expect(resultado.run?.caminho).toBeDefined()
    expect(resultado.familias).toEqual(["conversa"])
    expect(resultado.marcas).toEqual([])
  })

  it("manda a mensagem pela conversa, confere as checagens e colhe o texto e as etapas", async () => {
    const { resultado, colhido } = await rodarConversa(casoConversa, {
      runtime: createScriptedRuntime(soAtalhos.roteiro),
      llm: createFakeLlm([{ apontamentos: [] }]), // a única chamada é a do Juiz
    })

    expect(resultado.tipo).toBe("conversa")
    expect(resultado.erro).toBeUndefined()
    expect(resultado.checagens.map((c) => c.ok)).toEqual([true, true])
    expect(resultado.checagens.map((c) => c.lista)).toEqual(["deve", "nao_pode"])
    expect(resultado.acertou).toBe(true)
    expect(colhido.texto.length).toBeGreaterThan(0)
    expect(colhido.etapas.length).toBeGreaterThan(0)
  })

  it("uma conversa no caminho alerta, sem etapa de validação, não tem trajetória e não conta validações", async () => {
    const alerta = cenariosDeGuardrails["alerta-por-codigo"]
    if (!alerta) throw new Error("cenário alerta-por-codigo ausente")
    const { roteiro, ...semRoteiro } = alerta
    const caso: CasoConversa = {
      tipo: "conversa",
      familias: ["seguranca"],
      id: "t-alerta",
      titulo: "Dor forte no peito",
      cenario: semRoteiro,
      deve: [],
      naoPode: [],
    }

    const { resultado } = await rodarConversa(caso, {
      runtime: createScriptedRuntime(roteiro),
      llm: createFakeLlm([]),
    })

    expect(resultado.run?.caminho).toBe("alerta")
    expect(resultado.run?.trajetoriaOk).toBeNull()
    expect(resultado.run?.validacoes).toEqual([])
    expect(resultado.erro).toBeUndefined()
  })
})

describe("runner da conversa com proposta", () => {
  const casaSozinha = cenariosDeConversa["casa-sozinha"]
  if (!casaSozinha) throw new Error("cenário casa-sozinha ausente")
  const { roteiro, respostas: _respostas, ...semRoteiro } = casaSozinha

  const casoDeProposta = (parcial: Partial<CasoConversa> = {}): CasoConversa => ({
    tipo: "conversa",
    familias: ["propostas"],
    id: "t-proposta",
    titulo: "Compras da feira",
    cenario: semRoteiro,
    proposta: "esperada",
    deve: [
      {
        descricao: "termina no bloco, com ao menos uma proposta",
        confere: ({ resposta, propostas }) =>
          resposta.status === "waiting_for_approval" && propostas.length > 0,
      },
    ],
    naoPode: [],
    ...parcial,
  })

  const opcoes = () => ({
    runtime: createScriptedRuntime(roteiro),
    llm: createFakeLlm([casaSozinha.interpretacao]),
  })

  it("o caso termina no bloco: a expectativa vê as propostas e o resultado sai sem recusas", async () => {
    const { resultado } = await rodarConversa(casoDeProposta(), opcoes())

    expect(resultado.erro).toBeUndefined()
    expect(resultado.checagens.every((c) => c.ok)).toBe(true)
    expect(resultado.run?.propostasRecusadas).toBe(0)
  })

  it("o runner não decide o bloco: a checagem do status waiting_for_approval passa e o run segue no bloco", async () => {
    const caso = casoDeProposta({
      deve: [
        {
          descricao: "segue aguardando aprovação",
          confere: ({ resposta }) => resposta.status === "waiting_for_approval",
        },
      ],
    })
    const { resultado } = await rodarConversa(caso, opcoes())
    expect(resultado.checagens).toEqual([
      { lista: "deve", descricao: "segue aguardando aprovação", ok: true },
    ])
  })

  it("o cenário do runner sai sem toques, e os retornos ficam", () => {
    const comToque = {
      ...semRoteiro,
      toques: [{ tipo: "retorno" as const, sugestao: 0, resultado: "ajudou" as const }],
    }
    const sem = cenarioDoRunner(comToque)

    expect("toques" in sem).toBe(false)
    expect(sem.retornos).toEqual(semRoteiro.retornos)
  })

  it("o cenário do runner sai sem a decisão do bloco, para que nunca se aprove", () => {
    const original = cenariosDeConversa["casa-sozinha"]
    const sem = cenarioDoRunner(semRoteiro)

    expect("aprovacao" in sem).toBe(false)
    expect(sem.mensagem).toEqual(semRoteiro.mensagem)
    expect(semRoteiro.aprovacao).toEqual({ aprovar: [1] })
    expect(original?.aprovacao).toEqual({ aprovar: [1] })
  })
})

describe("runner da conversa com pausa", () => {
  const casaIncerta = cenariosComPausa["casa-incerta"]
  if (!casaIncerta) throw new Error("cenário casa-incerta ausente")
  const { roteiro, ...semRoteiro } = casaIncerta
  const respostaCasa: RespostaDaPessoa = {
    tipo: "casa",
    itens: [
      { alimento_id: "abobora", resposta: "tenho" },
      { alimento_id: "couve", resposta: "nao_tenho" },
    ],
  }

  function casoComPausa(
    parcial: Partial<Pick<CasoConversa, "respostas" | "deve">> = {},
  ): CasoConversa {
    const { respostas: _ignorada, ...cenario } = semRoteiro
    return {
      tipo: "conversa",
      familias: ["conversa"],
      id: "t-pausa",
      titulo: "Casa incerta",
      cenario,
      respostas: [respostaCasa],
      deve: [],
      naoPode: [],
      ...parcial,
    }
  }

  const opcoes = () => ({
    runtime: createScriptedRuntime(roteiro),
    llm: createFakeLlm([casaIncerta.interpretacao]),
  })

  it("responde a pausa com as respostas do caso, na ordem, e a expectativa vê as perguntas", async () => {
    const { resultado } = await rodarConversa(
      casoComPausa({
        deve: [
          {
            descricao: "uma pergunta de casa, com a resposta dada",
            confere: ({ perguntas }) =>
              perguntas.length === 1 &&
              perguntas[0]?.pergunta.tipo === "casa" &&
              perguntas[0]?.resposta.tipo === "casa",
          },
        ],
      }),
      opcoes(),
    )

    expect(resultado.checagens.every((c) => c.ok)).toBe(true)
    expect(resultado.run?.perguntasFeitas).toBe(1)
    expect(resultado.erro).toBeUndefined()
  })

  it("sem resposta sobrando, a pausa recebe pular", async () => {
    const { resultado } = await rodarConversa(
      casoComPausa({
        respostas: undefined,
        deve: [
          {
            descricao: "a pausa recebe pular",
            confere: ({ perguntas }) => perguntas[0]?.resposta.tipo === "pular",
          },
        ],
      }),
      opcoes(),
    )

    expect(resultado.checagens.every((c) => c.ok)).toBe(true)
    expect(resultado.run?.perguntasFeitas).toBe(1)
  })

  it("sem pausa, não há perguntas nem recusas", async () => {
    const { resultado } = await rodarConversa(
      {
        tipo: "conversa",
        familias: ["conversa"],
        id: "t-sem-pausa",
        titulo: "Só atalhos",
        cenario: soAtalhos,
        deve: [],
        naoPode: [],
      },
      { runtime: createScriptedRuntime(soAtalhos.roteiro), llm: createFakeLlm([]) },
    )

    expect(resultado.run?.perguntasFeitas).toBe(0)
    expect(resultado.run?.perguntasRecusadas).toBe(0)
  })
})

describe("pausas acima do teto de retomadas", () => {
  const casaVazia = cenariosComPausa["casa-vazia"]
  if (!casaVazia) throw new Error("cenário casa-vazia ausente")
  const { roteiro: _roteiro, respostas: _respostas, ...cenario } = casaVazia
  const pede = (ids: string[]): PassoRoteirizado => ({
    texto: "Vou perguntar à pessoa.",
    chamadas: [{ nome: "ask_user", argumentos: { tipo: "casa", alimentos: ids } }],
  })

  it("um caso que pausa quatro vezes sai como falho com o motivo, sem run e com checagens falsas, e o caso seguinte roda", async () => {
    const quatroPausas: CasoConversa = {
      tipo: "conversa",
      familias: ["conversa"],
      id: "t-quatro-pausas",
      titulo: "Quatro pausas",
      cenario,
      deve: [{ descricao: "uma expectativa qualquer", confere: () => true }],
      naoPode: [],
    }
    const { resultado: falho, colhido } = await rodarConversa(quatroPausas, {
      runtime: createScriptedRuntime([
        pede(["mandioca"]),
        pede(["inhame"]),
        pede(["ghee"]),
        pede(["azeite"]),
      ]),
      llm: createFakeLlm([casaVazia.interpretacao]),
    })

    expect(falho.erro).toBe(`pausou mais de ${MAXIMO_DE_RETOMADAS} vezes`)
    expect(falho.run).toBeUndefined()
    expect(falho.checagens).toEqual([
      { lista: "deve", descricao: "uma expectativa qualquer", ok: false },
    ])
    expect(falho.acertou).toBe(false)
    expect(colhido.texto).toBe("")

    const { resultado: seguinte } = await rodarConversa(
      {
        tipo: "conversa",
        familias: ["conversa"],
        id: "t-seguinte",
        titulo: "Só atalhos",
        cenario: soAtalhos,
        deve: [],
        naoPode: [],
      },
      { runtime: createScriptedRuntime(soAtalhos.roteiro), llm: createFakeLlm([]) },
    )
    expect(seguinte.erro).toBeUndefined()
  })
})

function etapa(
  tipo: RunEtapa["tipo"],
  nome: string,
  ordem: number,
  status: RunEtapa["status"] = "ok",
): RunEtapa {
  return {
    run_id: "run-eval",
    ordem,
    tipo,
    nome,
    resumo: null,
    status,
    duracao_ms: 1,
    modelo: null,
    tokens_entrada: 0,
    tokens_saida: 0,
    criado_em: AGORA,
  }
}

describe("respostas como função", () => {
  const perguntaDeUmItem: Pergunta = {
    tipo: "casa",
    texto: "Você tem abóbora?",
    itens: [{ alimento_id: "abobora", nome: "abóbora" }],
  }

  it("a função recebe a pergunta que saiu e a resposta é o que ela devolve", () => {
    expect(resolverResposta(tenhoATudo, perguntaDeUmItem)).toEqual({
      tipo: "casa",
      itens: [{ alimento_id: "abobora", resposta: "tenho" }],
    })
  })

  it("resposta fixa passa como está; posição sem resposta vira pular", () => {
    const fixa: RespostaDaPessoa = { tipo: "variante", variante: "latejante" }
    expect(resolverResposta(fixa, perguntaDeUmItem)).toBe(fixa)
    expect(resolverResposta(undefined, perguntaDeUmItem)).toEqual({ tipo: "pular" })
  })

  it("com LLM falso, a pausa recebe a resposta montada com os itens que saíram", async () => {
    const casaIncerta = cenariosComPausa["casa-incerta"]
    if (!casaIncerta) throw new Error("cenário casa-incerta ausente")
    const { roteiro, respostas: _ignorada, ...cenario } = casaIncerta
    const caso: CasoConversa = {
      tipo: "conversa",
      familias: ["conversa"],
      id: "t-resposta-na-hora",
      titulo: "Resposta montada na hora",
      cenario,
      respostas: [tenhoATudo],
      deve: [
        {
          descricao: "a pausa recebe tenho em todos os itens que saíram",
          confere: ({ perguntas }) => {
            const p = perguntas[0]
            if (p?.pergunta.tipo !== "casa" || p.resposta.tipo !== "casa") return false
            return (
              p.resposta.itens.length === p.pergunta.itens.length &&
              p.resposta.itens.every((i) => i.resposta === "tenho")
            )
          },
        },
      ],
      naoPode: [],
    }
    const { resultado } = await rodarConversa(caso, {
      runtime: createScriptedRuntime(roteiro),
      llm: createFakeLlm([casaIncerta.interpretacao]),
    })
    expect(resultado.erro).toBeUndefined()
    expect(resultado.checagens.every((c) => c.ok)).toBe(true)
  })
})

describe("runner da conversa com retornos fechados", () => {
  const retornoPeloAgente = cenariosDeAprendizado["retorno-pelo-agente"]
  if (!retornoPeloAgente) throw new Error("cenário retorno-pelo-agente ausente")
  const { roteiro, ...semRoteiro } = retornoPeloAgente
  const FECHADO = "Arroz bem cozido com abóbora e ghee"
  const PENDENTE = "Chá de gengibre com canela"

  const casoDeRetorno = (): CasoConversa => ({
    tipo: "conversa",
    familias: ["aprendizado"],
    id: "t-retorno",
    titulo: "Retorno contado na mensagem",
    cenario: semRoteiro,
    deve: [
      {
        descricao: "fecha o retorno de ontem pelo título",
        confere: ({ retornosFechados }) => retornosFechados.includes(FECHADO),
      },
    ],
    naoPode: [
      {
        descricao: "não fecha o chá, que segue pendente",
        confere: ({ retornosFechados }) => !retornosFechados.includes(PENDENTE),
      },
    ],
  })

  const opcoes = () => ({
    runtime: createScriptedRuntime(roteiro),
    llm: createFakeLlm([retornoPeloAgente.interpretacao]),
  })

  it("o retorno que o agente fechou entra em retornosFechados, pelo título da sugestão", async () => {
    const { resultado } = await rodarConversa(casoDeRetorno(), opcoes())

    expect(resultado.erro).toBeUndefined()
    expect(resultado.checagens).toEqual([
      { lista: "deve", descricao: "fecha o retorno de ontem pelo título", ok: true },
      { lista: "nao_pode", descricao: "não fecha o chá, que segue pendente", ok: true },
    ])
  })

  it("o resultado leva a família do caso", async () => {
    const { resultado } = await rodarConversa(casoDeRetorno(), opcoes())
    expect(resultado.familias).toEqual(["aprendizado"])
  })
})

describe("runner do acompanhante com pausa", () => {
  const roteiroComPausa = (pedido: Record<string, unknown>) => [
    { chamadas: [{ nome: "casa.ler", argumentos: {} }] },
    { chamadas: [{ nome: "ask_user", argumentos: pedido }] },
    {
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta: "Um chá morno de gengibre ajuda a aquecer, sem pesar.",
            explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
            sugestoes: [],
            evitar: [],
            incertos: [],
            citados: [],
          },
        },
      ],
    },
  ]

  it.each([
    ["c1-08-casa-so-incertos", { tipo: "casa", alimentos: ["abobora", "arroz-branco"] }],
    ["c1-11-sem-cidade", { tipo: "casa", alimentos: ["camomila"] }],
  ])("%s: pausa, a pessoa pula a pergunta e o run entrega a saída", async (id, pedido) => {
    const caso = casosC1.find((c) => c.id === id)
    if (!caso) throw new Error(`caso ${id} ausente`)

    const { resultado, colhido } = await rodarAcompanhante(caso, {
      runtime: createScriptedRuntime(roteiroComPausa(pedido)),
    })

    expect(resultado.run?.perguntasFeitas).toBe(1)
    expect(resultado.erro).toBeUndefined()
    expect(resultado.tipo).toBe("acompanhante")
    expect(colhido.texto.length).toBeGreaterThan(0)
    expect(colhido.saida?.resposta).toBe(colhido.texto)
  })

  it("sem pausa, devolve o caso com zero perguntas", async () => {
    const caso = casosC1.find((c) => c.id === "c1-11-sem-cidade")
    if (!caso) throw new Error("caso ausente")

    const { resultado } = await rodarAcompanhante(caso, {
      runtime: createScriptedRuntime(roteiroComPausa({}).filter((_, i) => i !== 1)),
    })

    expect(resultado.run?.perguntasFeitas).toBe(0)
  })

  it("pausa além do teto de retomadas falha o caso com RituError pausa_acima_do_teto", async () => {
    const caso = casosC1.find((c) => c.id === "c1-08-casa-so-incertos")
    if (!caso) throw new Error("caso ausente")
    const pergunta = (alimento: string): PassoRoteirizado => ({
      texto: "Vou perguntar à pessoa.",
      chamadas: [{ nome: "ask_user", argumentos: { tipo: "casa", alimentos: [alimento] } }],
    })
    // Quatro itens diferentes: uma pausa a mais que as retomadas do teto.
    const roteiro = ["gengibre", "limao", "camomila", "cebola"].map(pergunta)
    expect(roteiro).toHaveLength(MAXIMO_DE_RETOMADAS + 1)

    await expect(
      rodarAcompanhante(caso, { runtime: createScriptedRuntime(roteiro) }),
    ).rejects.toMatchObject({ code: "pausa_acima_do_teto" })
  })
})

describe("motivos do Juiz no run", () => {
  const etapaDoJuiz = (resumo: string | null): RunEtapa => ({ ...etapa("juiz", "juiz", 1), resumo })

  it("lê os graves de reprovado e os registros, sem repetir", () => {
    expect(motivosDoJuizDasEtapas([etapaDoJuiz("reprovado: promessa, tom")])).toEqual([
      "promessa",
      "tom",
    ])
    expect(motivosDoJuizDasEtapas([etapaDoJuiz("aprovado; registros: jargao")])).toEqual(["jargao"])
    expect(
      motivosDoJuizDasEtapas([
        etapaDoJuiz("reprovado: promessa; registros: jargao"),
        etapaDoJuiz("reprovado: promessa"),
      ]),
    ).toEqual(["promessa", "jargao"])
  })

  it("aprovado sem registro, indisponível ou sem etapa não tem motivo", () => {
    expect(motivosDoJuizDasEtapas([etapaDoJuiz("aprovado")])).toEqual([])
    expect(motivosDoJuizDasEtapas([etapaDoJuiz("indisponivel")])).toEqual([])
    expect(motivosDoJuizDasEtapas([etapaDoJuiz(null)])).toEqual([])
    expect(motivosDoJuizDasEtapas([])).toEqual([])
  })
})
