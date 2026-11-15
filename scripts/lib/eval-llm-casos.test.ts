import { describe, expect, it, vi } from "vitest"

// Limite de perguntas por run alto só neste arquivo: o teste de pausas acima do teto precisa de quatro pausas.
vi.mock("../../config/pausas", () => ({
  pausas: { maxPerguntasPorRun: 10, maxItensPorPergunta: 5, maxRefeicoesAPerguntar: 2 },
}))

import { casosC1 } from "../../evals/llm/casos/c1"
import type { CasoConversa, CasoInterprete } from "../../evals/llm/casos/c2"
import { casosC2 } from "../../evals/llm/casos/c2"
import {
  caminho,
  campoVazio,
  ehSuspeito,
  evitaGrupo,
  itemDeCasa,
  naoCaminho,
  naoComeAlimento,
  retorno,
  semAlerta,
  semEstados,
  semIntencao,
  semMotivo,
  semPendente,
  semVariante,
  temAlerta,
  temCampo,
  temEstado,
  temIncomodo,
  temIntencao,
  temRestricao,
  temUmaDe,
} from "../../evals/llm/casos/c2/intencao/expectativas"
import type { ExpectativaDoInterprete } from "../../evals/llm/casos/c2/tipos"
import type { Interpretacao } from "../../src/core/agents/interpreter/interpretacao"
import type { PedidoDePergunta } from "../../src/core/agents/tools/ask-user"
import type { RespostaDaPessoa } from "../../src/core/runs/pergunta"
import type { Caminho, RunEtapa } from "../../src/core/runs/ports"
import { createContainer } from "../../src/infra/container"
import { createFakeLlm } from "../../src/infra/fakes/fake-llm"
import {
  createScriptedRuntime,
  type PassoRoteirizado,
} from "../../src/infra/fakes/scripted-runtime"
import { cenariosComPausa, cenariosDeConversa, montarCenario } from "../../test/fixtures/cenarios"
import {
  conferir,
  contarEtapas,
  despachar,
  ehCheckpoint,
  formatarListagem,
  listarCasos,
  retornosFalsos,
  rodarConversa,
  rodarInterprete,
  versaoDosPrompts,
  violacoesDaPrimeiraEntrega,
} from "./eval-llm-casos"

const AGORA = "2026-06-15T22:00:00.000Z"

const soAtalhos = cenariosDeConversa["so-atalhos"]
if (!soAtalhos) throw new Error("cenário so-atalhos ausente")

const saidaDoInterprete = {
  intencoes: ["momento"],
  estados: ["com_frio"],
  itens_casa: [],
  evitar_sempre: [],
  nao_come: [],
  gosta: [],
  restricoes: [],
  suspeito: false,
}

const casoInterprete: CasoInterprete = {
  tipo: "interprete",
  id: "t-interprete",
  titulo: "Frio na mensagem",
  mensagem: "Estou com frio",
  deve: [
    {
      descricao: "entende o frio",
      confere: (r) => r.interpretacao.estados.includes("com_frio"),
    },
  ],
  naoPode: [
    {
      descricao: "não vai para fora",
      confere: (r) => r.caminho !== "fora",
    },
  ],
}

const casoConversa: CasoConversa = {
  tipo: "conversa",
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

describe("listagem por checkpoint", () => {
  it("c1-base lista os 12 casos do c1, sem tipo ausente", () => {
    const linhas = listarCasos("c1-base")
    expect(linhas).toHaveLength(12)
    expect(linhas.every((l) => l.pasta === "c1" && l.tipo === "acompanhante")).toBe(true)
  })

  it("c2-conversa lista os 12 do c1 e os 20 do c2", () => {
    const linhas = listarCasos("c2-conversa")
    expect(linhas).toHaveLength(32)
    expect(linhas.slice(0, 12).every((l) => l.pasta === "c1")).toBe(true)
    expect(linhas.slice(12).every((l) => l.pasta === "c2" && l.tipo === "interprete")).toBe(true)
  })

  it("c2 tem 20 casos do Intérprete, com ids únicos", () => {
    expect(casosC2).toHaveLength(20)
    expect(casosC2.every((c) => c.tipo === "interprete")).toBe(true)
    expect(new Set(casosC2.map((c) => c.id)).size).toBe(20)
  })

  it("formata cada caso com pasta, id, tipo e título", () => {
    const texto = formatarListagem(listarCasos("c1-base"))
    expect(texto).toContain("c1")
    expect(texto).toContain(casosC1[0]?.id ?? "")
    expect(texto).toContain("acompanhante")
    expect(texto).toContain(casosC1[0]?.titulo ?? "")
  })

  it("checkpoint desconhecido dá erro com a lista de checkpoints", () => {
    expect(() => listarCasos("c9-nada")).toThrow(/c1-base, c2-conversa/)
    expect(ehCheckpoint("c9-nada")).toBe(false)
    expect(ehCheckpoint("c2-conversa")).toBe(true)
  })
})

describe("despacho por tipo", () => {
  const dispachos = {
    acompanhante: () => "acompanhante",
    interprete: () => "interprete",
    conversa: () => "conversa",
  }

  it("caso sem tipo vai a acompanhante", () => {
    expect(despachar(casosC1[0] ?? casoInterprete, dispachos)).toBe("acompanhante")
  })

  it("caso interprete e caso conversa vão aos seus tipos", () => {
    expect(despachar(casoInterprete, dispachos)).toBe("interprete")
    expect(despachar(casoConversa, dispachos)).toBe("conversa")
  })
})

describe("conferência de expectativas", () => {
  it("confere cada expectativa e devolve descrição com ok", () => {
    const r = conferir(casoInterprete.deve, {
      interpretacao: {
        intencoes: ["momento"],
        estados: ["com_frio"],
        itens_casa: [],
        evitar: [],
        nao_come: [],
        gosta: [],
        restricoes: [],
        suspeito: false,
      },
      caminho: "acompanhante",
    })
    expect(r).toEqual([{ descricao: "entende o frio", ok: true }])
  })
})

describe("retornos falsos do Intérprete", () => {
  it("numera p1, p2 e marca como aguardando, sem alimentos", () => {
    const retornos = retornosFalsos(
      [
        { tipo: "cha", titulo: "Chá de gengibre" },
        { tipo: "oleo", titulo: "Óleo de gergelim" },
      ],
      AGORA,
    )
    expect(retornos.map((r) => r.id)).toEqual(["p1", "p2"])
    expect(retornos[0]?.status).toBe("aguardando")
    expect(retornos[1]?.sugestao).toEqual({
      tipo: "oleo",
      titulo: "Óleo de gergelim",
      alimentos: [],
    })
  })
})

describe("violações da primeira entrega", () => {
  const validacao = (n: number) => ({ nome: "validacao", atributos: { "validacao.violacoes": n } })
  const violacao = (codigo: string) => ({
    nome: "ritu_validacao_violacoes_total",
    rotulos: { violacao: codigo },
  })

  it("pega só as n primeiras métricas, onde n é do primeiro span validacao", () => {
    const spans = [{ nome: "interprete", atributos: {} }, validacao(2), validacao(1)]
    const metricas = [violacao("fora_da_base"), violacao("estrutura"), violacao("linha_base")]
    expect(violacoesDaPrimeiraEntrega(spans, metricas)).toEqual(["fora_da_base", "estrutura"])
  })

  it("sem violação na primeira, ou sem span de validação, dá lista vazia", () => {
    expect(violacoesDaPrimeiraEntrega([validacao(0)], [violacao("x")])).toEqual([])
    expect(violacoesDaPrimeiraEntrega([], [violacao("x")])).toEqual([])
  })
})

describe("versão dos prompts no cabeçalho", () => {
  const versoes = { acompanhante: "acompanhante.v2", interprete: "interprete.v1" }

  it("só acompanhante quando não há caso interprete", () => {
    expect(versaoDosPrompts(casosC1, versoes)).toBe("acompanhante.v2")
  })

  it("inclui interprete.v1 quando há caso interprete", () => {
    expect(versaoDosPrompts([...casosC1, casoInterprete], versoes)).toBe(
      "acompanhante.v2, interprete.v1",
    )
  })
})

describe("runner do Intérprete com LLM falso", () => {
  it("confere a interpretação e o caminho, e devolve o caso com a telemetria do apoio", async () => {
    const llm = createFakeLlm([saidaDoInterprete])
    const { deps } = await montarCenario(soAtalhos, { llm })
    const kb = createContainer().knowledge

    const r = await rodarInterprete(casoInterprete, {
      router: deps.router,
      client: llm,
      kb,
      clock: deps.clock,
    })

    expect(r.tipo).toBe("interprete")
    expect(r.erro).toBeUndefined()
    expect(r.deve).toEqual([{ descricao: "entende o frio", ok: true }])
    expect(r.naoPode).toEqual([{ descricao: "não vai para fora", ok: true }])
    expect(r.uso.apoio?.chamadas).toBe(1)
  })

  it("interpretação com alerta marca o caso como alertou", async () => {
    const llm = createFakeLlm([{ ...saidaDoInterprete, alerta: "emocional" }])
    const { deps } = await montarCenario(soAtalhos, { llm })
    const kb = createContainer().knowledge

    const r = await rodarInterprete(
      { ...casoInterprete, falsoAlerta: true },
      { router: deps.router, client: llm, kb, clock: deps.clock },
    )

    expect(r.falsoAlerta).toBe(true)
    expect(r.alertou).toBe(true)
  })

  it("Intérprete sem resposta conta como caso falho com o motivo", async () => {
    const llm = createFakeLlm([{ erro: "indisponivel" }])
    const { deps } = await montarCenario(soAtalhos, { llm })
    const kb = createContainer().knowledge

    const r = await rodarInterprete(casoInterprete, {
      router: deps.router,
      client: llm,
      kb,
      clock: deps.clock,
    })

    expect(r.erro).toBeDefined()
    expect(r.deve.every((x) => !x.ok)).toBe(true)
  })
})

describe("runner da conversa com LLM falso", () => {
  it("manda a mensagem pela conversa e colhe o resultado do run", async () => {
    const roteiro = soAtalhos.roteiro
    const r = await rodarConversa(casoConversa, {
      runtime: createScriptedRuntime(roteiro),
      llm: createFakeLlm([]),
    })

    expect(r.tipo).toBe("conversa")
    expect(r.erro).toBeUndefined()
    expect(r.deve.every((x) => x.ok)).toBe(true)
    expect(r.naoPode.every((x) => x.ok)).toBe(true)
  })
})

const base: Interpretacao = {
  intencoes: ["momento"],
  estados: ["com_frio"],
  itens_casa: [],
  evitar: [],
  nao_come: [],
  gosta: [],
  restricoes: [],
  suspeito: false,
}

const passa = (
  e: ExpectativaDoInterprete,
  r: Partial<Interpretacao> & { caminho?: Caminho } = {},
): boolean => {
  const { caminho: c = "acompanhante", ...dados } = r
  return e.confere({ interpretacao: { ...base, ...dados }, caminho: c })
}

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
    const r = await rodarConversa(
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

    expect(r.deve.every((x) => x.ok)).toBe(true)
    expect(r.perguntas).toEqual(["casa"])
    expect(r.erro).toBeUndefined()
  })

  it("sem resposta sobrando, a pausa recebe pular", async () => {
    const r = await rodarConversa(
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

    expect(r.deve.every((x) => x.ok)).toBe(true)
    expect(r.perguntas).toEqual(["casa"])
  })

  it("sem pausa, as perguntas são vazias e não há recusas", async () => {
    const r = await rodarConversa(
      {
        tipo: "conversa",
        id: "t-sem-pausa",
        titulo: "Só atalhos",
        cenario: soAtalhos,
        deve: [],
        naoPode: [],
      },
      { runtime: createScriptedRuntime(soAtalhos.roteiro), llm: createFakeLlm([]) },
    )

    expect(r.perguntas).toEqual([])
    expect(r.recusadas).toBe(0)
  })
})

describe("pausas acima do teto de retomadas", () => {
  const casaVazia = cenariosComPausa["casa-vazia"]
  if (!casaVazia) throw new Error("cenário casa-vazia ausente")
  const { roteiro: _roteiro, respostas: _respostas, ...cenario } = casaVazia
  const pede = (ids: string[]): PassoRoteirizado => ({
    texto: "Vou perguntar à pessoa.",
    chamadas: [
      { nome: "ask_user", argumentos: { tipo: "casa", alimentos: ids } satisfies PedidoDePergunta },
    ],
  })

  it("um caso que pausa quatro vezes sai como falho com o motivo, e o caso seguinte roda", async () => {
    const quatroPausas: CasoConversa = {
      tipo: "conversa",
      id: "t-quatro-pausas",
      titulo: "Quatro pausas",
      cenario,
      deve: [],
      naoPode: [],
    }
    const falho = await rodarConversa(quatroPausas, {
      runtime: createScriptedRuntime([
        pede(["mandioca"]),
        pede(["inhame"]),
        pede(["ghee"]),
        pede(["azeite"]),
      ]),
      llm: createFakeLlm([casaVazia.interpretacao]),
    })

    expect(falho.erro).toBe("pausou mais de 3 vezes")
    expect(falho.perguntas).toHaveLength(3)

    const seguinte = await rodarConversa(
      {
        tipo: "conversa",
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

describe("contagem de recusas e de chamadas antes da pausa", () => {
  it("conta as recusas de ask_user e as chamadas de modelo antes da primeira pergunta", () => {
    const etapas = [
      etapa("llm", "decisao", 1),
      etapa("pergunta", "casa", 2),
      etapa("llm", "decisao", 3),
      etapa("validacao", "ask_user", 4, "recusado"),
      etapa("llm", "decisao", 5),
    ]
    expect(contarEtapas(etapas)).toEqual({ recusadas: 1, llmAntesDaPrimeiraPausa: 1 })
  })

  it("sem pausa, conta todas as chamadas de modelo", () => {
    const etapas = [etapa("llm", "decisao", 1), etapa("llm", "decisao", 2)]
    expect(contarEtapas(etapas)).toEqual({ recusadas: 0, llmAntesDaPrimeiraPausa: 2 })
  })

  it("só ask_user recusado conta; outra tool recusada e ask_user aceito não", () => {
    const etapas = [
      etapa("validacao", "finalizar", 1, "recusado"),
      etapa("validacao", "ask_user", 2, "ok"),
    ]
    expect(contarEtapas(etapas)).toEqual({ recusadas: 0, llmAntesDaPrimeiraPausa: 0 })
  })
})

describe("expectativas do Intérprete", () => {
  it("temIntencao e semIntencao", () => {
    expect(passa(temIntencao("momento"), {})).toBe(true)
    expect(passa(temIntencao("casa"), {})).toBe(false)
    expect(passa(semIntencao("momento"), {})).toBe(false)
    expect(passa(semIntencao("casa"), {})).toBe(true)
  })

  it("temUmaDe passa se alguma das intenções está", () => {
    expect(passa(temUmaDe("vida", "momento"), {})).toBe(true)
    expect(passa(temUmaDe("vida", "pergunta"), {})).toBe(false)
  })

  it("temEstado e semEstados", () => {
    expect(passa(temEstado("com_frio"), {})).toBe(true)
    expect(passa(temEstado("sem_energia"), {})).toBe(false)
    expect(passa(semEstados(), { estados: [] })).toBe(true)
    expect(passa(semEstados(), {})).toBe(false)
  })

  it("temAlerta e semAlerta, com ou sem tipo", () => {
    expect(passa(temAlerta(), { alerta: "fisico" })).toBe(true)
    expect(passa(temAlerta(), {})).toBe(false)
    expect(passa(temAlerta("fisico"), { alerta: "emocional" })).toBe(false)
    expect(passa(semAlerta(), {})).toBe(true)
    expect(passa(semAlerta(), { alerta: "emocional" })).toBe(false)
  })

  it("temIncomodo e semVariante", () => {
    expect(passa(temIncomodo("dor-de-cabeca"), { incomodo: { id: "dor-de-cabeca" } })).toBe(true)
    expect(passa(temIncomodo("dor-de-cabeca"), {})).toBe(false)
    expect(passa(semVariante(), { incomodo: { id: "dor-de-cabeca" } })).toBe(true)
    expect(passa(semVariante(), { incomodo: { id: "dor-de-cabeca", variante: "tensa" } })).toBe(
      false,
    )
  })

  it("itemDeCasa confere alimento e ação", () => {
    const item = { alimento_id: "abobora", nome: "abóbora", acao: "tem" as const }
    expect(passa(itemDeCasa("abobora", "tem"), { itens_casa: [item] })).toBe(true)
    expect(passa(itemDeCasa("abobora", "acabou"), { itens_casa: [item] })).toBe(false)
    expect(passa(itemDeCasa("couve", "tem"), { itens_casa: [item] })).toBe(false)
  })

  it("retorno confere resultado e, se pedido, o pendente pela posição", () => {
    const r = { resultado: "ajudou" as const, retorno_id: "p1", titulo: "Chá" }
    expect(passa(retorno("ajudou"), { retorno: r })).toBe(true)
    expect(passa(retorno("ajudou", 1), { retorno: r })).toBe(true)
    expect(passa(retorno("ajudou", 2), { retorno: r })).toBe(false)
    expect(passa(retorno("nao_ajudou"), { retorno: r })).toBe(false)
    expect(passa(retorno("ajudou"), {})).toBe(false)
  })

  it("semPendente passa quando o retorno não aponta pendente", () => {
    expect(passa(semPendente(), { retorno: { resultado: "ajudou" } })).toBe(true)
    expect(passa(semPendente(), { retorno: { resultado: "ajudou", retorno_id: "p1" } })).toBe(false)
  })

  it("evitaGrupo confere o grupo em evitar", () => {
    const evitar = [{ tipo: "grupo" as const, valor: "frutos_do_mar" }]
    expect(passa(evitaGrupo("frutos_do_mar"), { evitar })).toBe(true)
    expect(passa(evitaGrupo("peixe"), { evitar })).toBe(false)
  })

  it("semMotivo procura as palavras em qualquer texto, sem acento nem caixa", () => {
    const evitar = [{ tipo: "grupo" as const, valor: "frutos_do_mar" }]
    expect(passa(semMotivo(["alergica", "alergia"]), { evitar })).toBe(true)
    expect(passa(semMotivo(["alergica", "alergia"]), { fato_de_rotina: "Sou ALÉRGICA" })).toBe(
      false,
    )
    expect(passa(semMotivo(["alergia"]), { nao_come: [{ nome: "alergia a leite" }] })).toBe(false)
  })

  it("naoComeAlimento confere o alimento em nao_come", () => {
    const nao_come = [{ alimento_id: "coentro-fresco", nome: "Coentro" }]
    expect(passa(naoComeAlimento("coentro-fresco"), { nao_come })).toBe(true)
    expect(passa(naoComeAlimento("manga"), { nao_come })).toBe(false)
  })

  it("temRestricao confere a restrição", () => {
    expect(passa(temRestricao("vegetariana"), { restricoes: ["vegetariana"] })).toBe(true)
    expect(passa(temRestricao("vegana"), { restricoes: ["vegetariana"] })).toBe(false)
  })

  it("caminho e naoCaminho conferem o caminho recebido", () => {
    expect(passa(caminho("acompanhante"), {})).toBe(true)
    expect(passa(caminho("fora"), {})).toBe(false)
    expect(passa(naoCaminho("fora"), {})).toBe(true)
    expect(passa(naoCaminho("acompanhante"), {})).toBe(false)
  })

  it("campoVazio e temCampo olham o campo da interpretação", () => {
    expect(passa(campoVazio("alerta"), {})).toBe(true)
    expect(passa(campoVazio("alerta"), { alerta: "fisico" })).toBe(false)
    expect(passa(campoVazio("evitar"), { evitar: [] })).toBe(true)
    expect(passa(temCampo("fato_de_rotina"), { fato_de_rotina: "almoço pesado" })).toBe(true)
    expect(passa(temCampo("fato_de_rotina"), {})).toBe(false)
  })

  it("ehSuspeito confere o flag suspeito", () => {
    expect(passa(ehSuspeito(), { suspeito: true })).toBe(true)
    expect(passa(ehSuspeito(), {})).toBe(false)
  })
})
