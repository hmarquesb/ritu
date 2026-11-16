import { describe, expect, it, vi } from "vitest"

// Limite de perguntas por run alto só neste arquivo: o teste de pausas acima do teto precisa de quatro pausas.
vi.mock("../../config/pausas", () => ({
  pausas: { maxPerguntasPorRun: 10, maxItensPorPergunta: 5, maxRefeicoesAPerguntar: 2 },
}))

import { casosC1, type ResultadoDoRun } from "../../evals/llm/casos/c1"
import type { CasoConversa, CasoInterprete } from "../../evals/llm/casos/c2"
import { casosC2 } from "../../evals/llm/casos/c2"
import {
  apareceNasSugestoes,
  apontaComoFicou,
  chamouResultadoRegistrar,
  fechouRetorno,
  naoAparece,
  naoFechou,
  nenhumRetornoFechado,
  primeiroDoTipoNao,
  reconheceRetorno,
} from "../../evals/llm/casos/c2/aprendizado/expectativas"
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
import {
  comParaTer,
  falaDasProximasVezes,
  semFraseDeCompra,
  semParaTer,
} from "../../evals/llm/casos/c2/para-ter/expectativas"
import {
  itensNaPergunta,
  naoGostaDoPrimeiroTenhoOsOutros,
  naoPerguntou,
  naoTenhoATudo,
  nuncaPerguntou,
  pausouSemDecisao,
  perguntouCasa,
  perguntouNoMaximo,
  semItemNaoGostado,
  semItemNaSaida,
  semSegundaPerguntaSobre,
  sugestaoQueRefresca,
  temAvisoDeIncomodo,
  tenhoATudo,
  terminou,
} from "../../evals/llm/casos/c2/perguntas/expectativas"
import {
  blocoComRestricao,
  blocoComRotina,
  chamouMemoriaPropor,
  listaNoMaximoUma,
  listaSoDe,
  naoDizQueAnotou,
  nenhumaListaAceita,
  nenhumaProposta,
  semAlimentoBarrado,
} from "../../evals/llm/casos/c2/propostas/expectativas"
import type { ExpectativaDaConversa, ExpectativaDoInterprete } from "../../evals/llm/casos/c2/tipos"
import type { CasoJuiz, CasoMemoria } from "../../evals/llm/casos/c3"
import type { SaidaDoAcompanhante, SugestaoEntregue } from "../../src/core/agents/companion/saida"
import type { Interpretacao } from "../../src/core/agents/interpreter/interpretacao"
import type { PedidoDePergunta } from "../../src/core/agents/tools/ask-user"
import type { PropostaNaSaida } from "../../src/core/proposals/conteudo"
import type { Pergunta, RespostaDaPessoa } from "../../src/core/runs/pergunta"
import type { Caminho, RunEtapa } from "../../src/core/runs/ports"
import { createContainer } from "../../src/infra/container"
import { createFakeLlm } from "../../src/infra/fakes/fake-llm"
import { createFixedClock } from "../../src/infra/fakes/fixed-clock"
import { createMiniKnowledge } from "../../src/infra/fakes/mini-knowledge"
import {
  createScriptedRuntime,
  type PassoRoteirizado,
} from "../../src/infra/fakes/scripted-runtime"
import {
  cenariosComPausa,
  cenariosDeAprendizado,
  cenariosDeConversa,
  montarCenario,
} from "../../test/fixtures/cenarios"
import { MAXIMO_DE_RETOMADAS } from "../../test/fixtures/cenarios/rodar"
import { motivosDoJuizDasEtapas } from "./demo-report"
import {
  arquivoDoRelatorio,
  casosDoCheckpoint,
  cenarioDoRunner,
  checagemDoJuiz,
  conferir,
  contarEtapas,
  despachar,
  ehCheckpoint,
  formatarListagem,
  idsDeCasos,
  listarCasos,
  resolverResposta,
  retornosFalsos,
  rodarAcompanhante,
  rodarConversa,
  rodarInterprete,
  rodarJuiz,
  rodarMemoria,
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
  familias: ["intencao"],
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

const saidaDoJuiz: SaidaDoAcompanhante = {
  origem: "agente",
  resposta: "Um prato morno, sem tela.",
  geral: false,
  avisos: [],
  explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
  sugestoes: [],
  evitar: [],
  incertos: [],
  citados: [],
  anotacoes: [],
  propostas: [],
}

const casoJuiz: CasoJuiz = {
  tipo: "juiz",
  familias: ["juiz"],
  id: "t-juiz",
  titulo: "Promessa de cura",
  familia: "juiz",
  saida: { ...saidaDoJuiz, resposta: "Isso cura a dor." },
  evitar: [],
  motivos: ["promessa"],
  deve: [
    {
      descricao: "aponta a promessa",
      confere: (v) => v.ok && v.graves.includes("promessa"),
    },
  ],
  naoPode: [
    {
      descricao: "não aprova",
      confere: (v) => !(v.ok && v.aprovado),
    },
  ],
}

const casoMemoria: CasoMemoria = {
  tipo: "memoria",
  familias: ["memoria"],
  id: "t-memoria",
  titulo: "Notas repetidas viram uma frase",
  familia: "memoria",
  notas: [
    { texto: "almoço fora na semana", diasAtras: 10 },
    { texto: "almoço fora de segunda a sexta", diasAtras: 3 },
  ],
  deve: [
    {
      descricao: "junta as repetidas",
      confere: ({ resumo }) => resumo.texto.includes("fora"),
    },
  ],
  naoPode: [
    {
      descricao: "não inventa diagnóstico",
      confere: ({ resumo }) => !resumo.texto.includes("diagnóstico"),
    },
  ],
}

describe("listagem por checkpoint", () => {
  it("c1-base lista os 12 casos do c1, sem tipo ausente", () => {
    const linhas = listarCasos("c1-base")
    expect(linhas).toHaveLength(12)
    expect(linhas.every((l) => l.pasta === "c1" && l.tipo === "acompanhante")).toBe(true)
  })

  it("c2-conversa lista os 12 do c1 e os 42 do c2", () => {
    const linhas = listarCasos("c2-conversa")
    expect(linhas).toHaveLength(54)
    expect(linhas.slice(0, 12).every((l) => l.pasta === "c1")).toBe(true)
    expect(linhas.slice(12).every((l) => l.pasta === "c2")).toBe(true)
    expect(linhas.slice(12).filter((l) => l.tipo === "interprete")).toHaveLength(20)
    expect(linhas.slice(12).filter((l) => l.tipo === "conversa")).toHaveLength(22)
  })

  it("c2 tem 20 casos do Intérprete e 22 de conversa (8 Perguntas, 6 Propostas, 5 Aprendizado, 3 Para ter em casa), com ids únicos", () => {
    expect(casosC2).toHaveLength(42)
    expect(casosC2.filter((c) => c.tipo === "interprete")).toHaveLength(20)
    expect(casosC2.filter((c) => c.tipo === "conversa")).toHaveLength(22)
    expect(new Set(casosC2.map((c) => c.id)).size).toBe(42)
  })

  it("os 8 casos de Perguntas são de conversa e têm mensagem", () => {
    const perguntas = casosC2.filter((c) => c.id.startsWith("c2-p"))
    expect(perguntas).toHaveLength(8)
    expect(perguntas.every((c) => c.tipo === "conversa" && !!c.cenario.mensagem.texto)).toBe(true)
  })

  it("os 6 casos de Propostas são de conversa e têm mensagem", () => {
    const propostas = casosC2.filter((c) => c.id.startsWith("c2-m"))
    expect(propostas).toHaveLength(6)
    expect(propostas.every((c) => c.tipo === "conversa" && !!c.cenario.mensagem.texto)).toBe(true)
  })

  it("c3-confiavel lista os 12 do c1, os 42 do c2 e os 30 do c3 (84)", () => {
    const linhas = listarCasos("c3-confiavel")
    expect(linhas).toHaveLength(84)
    expect(linhas.filter((l) => l.pasta === "c3")).toHaveLength(30)
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
    memoria: () => "memoria",
    juiz: () => "juiz",
  }

  it("caso sem tipo vai a acompanhante", () => {
    expect(despachar(casosC1[0] ?? casoInterprete, dispachos)).toBe("acompanhante")
  })

  it("caso memoria vai ao seu tipo", () => {
    expect(despachar(casoMemoria, dispachos)).toBe("memoria")
  })

  it("caso juiz vai ao seu tipo", () => {
    expect(despachar(casoJuiz, { ...dispachos, juiz: () => "juiz" })).toBe("juiz")
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
  const versoes = {
    acompanhante: "acompanhante.v2",
    interprete: "interprete.v1",
    memoria: "memoria.v1",
    juiz: "juiz.v1",
  }

  it("inclui juiz.v1 quando há caso juiz, e não sem ele", () => {
    expect(versaoDosPrompts([...casosC1, casoJuiz], versoes)).toBe("acompanhante.v2, juiz.v1")
    expect(versaoDosPrompts(casosC1, versoes)).not.toContain("juiz.v1")
  })

  it("só acompanhante quando não há caso interprete nem memoria", () => {
    expect(versaoDosPrompts(casosC1, versoes)).toBe("acompanhante.v2")
  })

  it("inclui memoria.v1 quando há caso memoria, e não o interprete", () => {
    expect(versaoDosPrompts([...casosC1, casoMemoria], versoes)).toBe("acompanhante.v2, memoria.v1")
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
      { client: llm, kb, clock: deps.clock },
    )

    expect(r.falsoAlerta).toBe(true)
    expect(r.alertou).toBe(true)
  })

  it("Intérprete sem resposta conta como caso falho com o motivo", async () => {
    const llm = createFakeLlm([{ erro: "indisponivel" }])
    const { deps } = await montarCenario(soAtalhos, { llm })
    const kb = createContainer().knowledge

    const r = await rodarInterprete(casoInterprete, {
      client: llm,
      kb,
      clock: deps.clock,
    })

    expect(r.erro).toBeDefined()
    expect(r.deve.every((x) => !x.ok)).toBe(true)
  })
})

describe("runner da conversa com LLM falso", () => {
  it("põe no resultado o juiz do run, o falso alerta marcado e se houve alerta", async () => {
    const r = await rodarConversa(
      { ...casoConversa, falsoAlerta: true },
      {
        runtime: createScriptedRuntime(soAtalhos.roteiro),
        llm: createFakeLlm([{ apontamentos: [] }]),
      },
    )

    expect(r.juiz).toEqual({ tentativas: 1, aprovado: true, motivos: [] })
    expect(r.falsoAlerta).toBe(true)
    expect(r.alertou).toBe(false)
  })

  it("manda a mensagem pela conversa e colhe o resultado do run", async () => {
    const roteiro = soAtalhos.roteiro
    const r = await rodarConversa(casoConversa, {
      runtime: createScriptedRuntime(roteiro),
      llm: createFakeLlm([{ apontamentos: [] }]), // a única chamada é a do Juiz
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

  it("o caso termina no bloco: a expectativa vê as propostas e o resultado sai com a contagem", async () => {
    const r = await rodarConversa(casoDeProposta(), opcoes())

    expect(r.erro).toBeUndefined()
    expect(r.deve.every((x) => x.ok)).toBe(true)
    expect(r.proposta).toBe("esperada")
    expect(r.propostas).toBeGreaterThan(0)
    expect(r.propostasRecusadas).toBe(0)
  })

  it("o runner não decide o bloco: o run lido do store depois do caso segue waiting_for_approval", async () => {
    const r = await rodarConversa(casoDeProposta(), opcoes())
    expect(r.statusDoRun).toBe("waiting_for_approval")
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
        familias: ["conversa"],
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
      familias: ["conversa"],
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

describe("contagem de recusas e de chamadas antes da pausa", () => {
  it("conta as recusas de ask_user e as chamadas de modelo antes da primeira pergunta", () => {
    const etapas = [
      etapa("llm", "decisao", 1),
      etapa("pergunta", "casa", 2),
      etapa("llm", "decisao", 3),
      etapa("validacao", "ask_user", 4, "recusado"),
      etapa("llm", "decisao", 5),
    ]
    expect(contarEtapas(etapas)).toEqual({
      recusadas: 1,
      llmAntesDaPrimeiraPausa: 1,
      propostasRecusadas: 0,
    })
  })

  it("sem pausa, conta todas as chamadas de modelo", () => {
    const etapas = [etapa("llm", "decisao", 1), etapa("llm", "decisao", 2)]
    expect(contarEtapas(etapas)).toEqual({
      recusadas: 0,
      llmAntesDaPrimeiraPausa: 2,
      propostasRecusadas: 0,
    })
  })

  it("só ask_user recusado conta; outra tool recusada e ask_user aceito não", () => {
    const etapas = [
      etapa("validacao", "finalizar", 1, "recusado"),
      etapa("validacao", "ask_user", 2, "ok"),
    ]
    expect(contarEtapas(etapas)).toEqual({
      recusadas: 0,
      llmAntesDaPrimeiraPausa: 0,
      propostasRecusadas: 0,
    })
  })

  it("conta as propostas recusadas pelo código: tool de proposta com resumo recusado:", () => {
    const comResumo = (e: RunEtapa, resumo: string | null): RunEtapa => ({ ...e, resumo })
    const etapas = [
      comResumo(etapa("tool", "memoria.propor", 1), "recusado: conteudo_invalido"),
      comResumo(etapa("tool", "lista.propor", 2), "recusado: fora_da_lista"),
      comResumo(etapa("tool", "lista.propor", 3), "proposto"),
      comResumo(etapa("tool", "finalizar", 4), "recusado: validacao"),
      comResumo(etapa("tool", "memoria.propor", 5), null),
    ]
    expect(contarEtapas(etapas).propostasRecusadas).toBe(2)
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
    const r = await rodarConversa(caso, {
      runtime: createScriptedRuntime(roteiro),
      llm: createFakeLlm([casaIncerta.interpretacao]),
    })
    expect(r.erro).toBeUndefined()
    expect(r.deve.every((x) => x.ok)).toBe(true)
  })
})

describe("expectativas da conversa de Perguntas", () => {
  type Entrada = Parameters<ExpectativaDaConversa["confere"]>[0]

  const saidaPronta = (p: Partial<SaidaDoAcompanhante> = {}): SaidaDoAcompanhante => ({
    origem: "agente",
    resposta: "Um prato morno.",
    geral: false,
    avisos: [],
    explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
    sugestoes: [],
    evitar: [],
    incertos: [],
    citados: [],
    anotacoes: [],
    propostas: [],
    ...p,
  })

  const sugestaoCom = (ids: string[], verbos: string[] = []): SugestaoEntregue => ({
    tipo: "refeicao",
    titulo: "Sopa morna",
    como_fazer: "Cozinhe e sirva quente.",
    motivo: "Esquenta.",
    linhas_base: [],
    novidade: false,
    verbos,
    itens: ids.map((id) => ({
      alimento_id: id,
      nome: id,
      contribui: [],
      verbos: [],
      linha_base: `alimentos:${id}`,
      casa: "confirmado",
    })),
  })

  const resultadoCom = (saida: SaidaDoAcompanhante): ResultadoDoRun => ({
    saida,
    status: "done",
    tools: [],
    chamadasDeModelo: 1,
    validacoes: ["ok"],
  })

  const entrada = (p: Partial<Entrada> = {}): Entrada => ({
    resposta: { run_id: "run-eval", status: "done", caminho: "acompanhante" },
    resultado: resultadoCom(saidaPronta()),
    perguntas: [],
    recusadas: 0,
    llmAntesDaPrimeiraPausa: 0,
    propostas: [],
    propostasRecusadas: 0,
    retornosFechados: [],
    juiz: { tentativas: 0, aprovado: null, motivos: [] },
    ...p,
  })

  const casaCom = (ids: string[]): Entrada["perguntas"][number] => ({
    pergunta: {
      tipo: "casa",
      texto: "Você tem?",
      itens: ids.map((id) => ({ alimento_id: id, nome: id })),
    },
    resposta: { tipo: "pular" },
  })

  const variante: Entrada["perguntas"][number] = {
    pergunta: {
      tipo: "variante",
      texto: "Qual dor?",
      incomodo: "dor-de-cabeca",
      opcoes: [{ id: "latejante", texto: "latejante" }],
    },
    resposta: { tipo: "variante", variante: "latejante" },
  }

  const passa = (e: ExpectativaDaConversa, r: Partial<Entrada>): boolean => e.confere(entrada(r))

  it("perguntouCasa e naoPerguntou", () => {
    expect(passa(perguntouCasa(), { perguntas: [casaCom(["abobora"])] })).toBe(true)
    expect(passa(perguntouCasa(), {})).toBe(false)
    expect(passa(naoPerguntou(), {})).toBe(true)
    expect(passa(naoPerguntou(), { perguntas: [casaCom(["abobora"])] })).toBe(false)
  })

  it("perguntouNoMaximo conta as perguntas do run", () => {
    expect(passa(perguntouNoMaximo(1), { perguntas: [casaCom(["abobora"])] })).toBe(true)
    expect(
      passa(perguntouNoMaximo(1), { perguntas: [casaCom(["abobora"]), casaCom(["couve"])] }),
    ).toBe(false)
  })

  it("itensNaPergunta limita os itens de cada pergunta de casa", () => {
    const seis = ["a", "b", "c", "d", "e", "f"]
    expect(passa(itensNaPergunta(5), { perguntas: [casaCom(["a", "b", "c"])] })).toBe(true)
    expect(passa(itensNaPergunta(5), { perguntas: [casaCom(seis)] })).toBe(false)
    expect(passa(itensNaPergunta(5), {})).toBe(false)
  })

  it("nuncaPerguntou olha os itens das perguntas de casa", () => {
    expect(passa(nuncaPerguntou("gengibre"), { perguntas: [casaCom(["abobora"])] })).toBe(true)
    expect(passa(nuncaPerguntou("gengibre"), { perguntas: [casaCom(["gengibre"])] })).toBe(false)
  })

  it("semItemNaSaida procura o id em sugestão ou citado, e o nome no texto", () => {
    expect(
      passa(semItemNaSaida("abobora"), {
        resultado: resultadoCom(saidaPronta({ sugestoes: [sugestaoCom(["arroz-branco"])] })),
      }),
    ).toBe(true)
    expect(
      passa(semItemNaSaida("abobora"), {
        resultado: resultadoCom(saidaPronta({ sugestoes: [sugestaoCom(["abobora"])] })),
      }),
    ).toBe(false)
    expect(
      passa(semItemNaSaida("abobora"), {
        resultado: resultadoCom(saidaPronta({ citados: ["alimentos:abobora"] })),
      }),
    ).toBe(false)
    expect(
      passa(semItemNaSaida("abobora"), {
        resultado: resultadoCom(saidaPronta({ resposta: "Use a abóbora." })),
      }),
    ).toBe(false)
  })

  it("semSegundaPerguntaSobre aceita uma pergunta por item e recusa duas", () => {
    expect(passa(semSegundaPerguntaSobre(["abobora"]), { perguntas: [casaCom(["abobora"])] })).toBe(
      true,
    )
    expect(
      passa(semSegundaPerguntaSobre(["abobora"]), {
        perguntas: [casaCom(["abobora"]), casaCom(["abobora", "couve"])],
      }),
    ).toBe(false)
  })

  it("pausouSemDecisao exige zero chamadas antes da variante", () => {
    expect(passa(pausouSemDecisao(), { perguntas: [variante] })).toBe(true)
    expect(passa(pausouSemDecisao(), { perguntas: [variante], llmAntesDaPrimeiraPausa: 1 })).toBe(
      false,
    )
    expect(passa(pausouSemDecisao(), { perguntas: [casaCom(["abobora"])] })).toBe(false)
  })

  it("temAvisoDeIncomodo confere o aviso de incômodo", () => {
    expect(
      passa(temAvisoDeIncomodo(), {
        resultado: resultadoCom(saidaPronta({ avisos: [{ tipo: "incomodo", texto: "Cuidado." }] })),
      }),
    ).toBe(true)
    expect(
      passa(temAvisoDeIncomodo(), {
        resultado: resultadoCom(saidaPronta({ avisos: [{ tipo: "geral", texto: "Oi." }] })),
      }),
    ).toBe(false)
  })

  it("sugestaoQueRefresca aceita frio ou brando em verbos ou contribui", () => {
    expect(
      passa(sugestaoQueRefresca(), {
        resultado: resultadoCom(
          saidaPronta({ sugestoes: [sugestaoCom(["melancia"], ["brando"])] }),
        ),
      }),
    ).toBe(true)
    expect(
      passa(sugestaoQueRefresca(), {
        resultado: resultadoCom(
          saidaPronta({ sugestoes: [sugestaoCom(["melancia"], ["quente"])] }),
        ),
      }),
    ).toBe(false)
  })

  it("terminou confere o status done", () => {
    expect(passa(terminou(), {})).toBe(true)
    const pausado: Partial<Entrada> = {
      resposta: { run_id: "run-eval", status: "waiting_for_input", caminho: "acompanhante" },
    }
    expect(passa(terminou(), pausado)).toBe(false)
  })

  it("terminou aceita o run parado no bloco de aprovação, que é onde o runner para", () => {
    const noBloco: Partial<Entrada> = {
      resposta: { run_id: "run-eval", status: "waiting_for_approval", caminho: "casa" },
    }
    expect(passa(terminou(), noBloco)).toBe(true)
  })

  it("semItemNaoGostado confere que o item marcado como não gosto não sai", () => {
    const naoGosto: Entrada["perguntas"][number] = {
      pergunta: {
        tipo: "casa",
        texto: "Você tem?",
        itens: [{ alimento_id: "abobora", nome: "abóbora" }],
      },
      resposta: { tipo: "casa", itens: [{ alimento_id: "abobora", resposta: "nao_gosto" }] },
    }
    expect(
      passa(semItemNaoGostado(), {
        perguntas: [naoGosto],
        resultado: resultadoCom(saidaPronta({ sugestoes: [sugestaoCom(["couve"])] })),
      }),
    ).toBe(true)
    expect(
      passa(semItemNaoGostado(), {
        perguntas: [naoGosto],
        resultado: resultadoCom(saidaPronta({ sugestoes: [sugestaoCom(["abobora"])] })),
      }),
    ).toBe(false)
  })

  it("as respostas montadas na hora seguem os itens da pergunta", () => {
    const casa: Pergunta = {
      tipo: "casa",
      texto: "Você tem?",
      itens: [
        { alimento_id: "abobora", nome: "abóbora" },
        { alimento_id: "couve", nome: "couve" },
      ],
    }
    expect(tenhoATudo(casa)).toEqual({
      tipo: "casa",
      itens: [
        { alimento_id: "abobora", resposta: "tenho" },
        { alimento_id: "couve", resposta: "tenho" },
      ],
    })
    expect(naoTenhoATudo(casa)).toEqual({
      tipo: "casa",
      itens: [
        { alimento_id: "abobora", resposta: "nao_tenho" },
        { alimento_id: "couve", resposta: "nao_tenho" },
      ],
    })
    expect(naoGostaDoPrimeiroTenhoOsOutros(casa)).toEqual({
      tipo: "casa",
      itens: [
        { alimento_id: "abobora", resposta: "nao_gosto" },
        { alimento_id: "couve", resposta: "tenho" },
      ],
    })
    expect(tenhoATudo(variante.pergunta)).toEqual({ tipo: "pular" })
  })
})

describe("expectativas da conversa de Propostas", () => {
  type Entrada = Parameters<ExpectativaDaConversa["confere"]>[0]

  const saidaPronta = (p: Partial<SaidaDoAcompanhante> = {}): SaidaDoAcompanhante => ({
    origem: "agente",
    resposta: "Um prato morno, sem tela.",
    geral: false,
    avisos: [],
    explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
    sugestoes: [],
    evitar: [],
    incertos: [],
    citados: [],
    anotacoes: [],
    propostas: [],
    ...p,
  })

  const sugestaoCom = (ids: string[]): SugestaoEntregue => ({
    tipo: "refeicao",
    titulo: "Prato morno",
    como_fazer: "Cozinhe e sirva quente.",
    motivo: "Esquenta.",
    linhas_base: [],
    novidade: false,
    verbos: [],
    itens: ids.map((id) => ({
      alimento_id: id,
      nome: id,
      contribui: [],
      verbos: [],
      linha_base: `alimentos:${id}`,
      casa: "confirmado",
    })),
  })

  const resultadoCom = (saida: SaidaDoAcompanhante, tools: string[] = []): ResultadoDoRun => ({
    saida,
    status: "waiting_for_approval",
    tools,
    chamadasDeModelo: 1,
    validacoes: ["ok"],
  })

  const proposta = (tool: PropostaNaSaida["tool"], texto: string): PropostaNaSaida => ({
    id: `${tool}-${texto}`,
    tool,
    texto,
  })

  const entrada = (p: Partial<Entrada> = {}): Entrada => ({
    resposta: { run_id: "run-eval", status: "waiting_for_approval", caminho: "acompanhante" },
    resultado: resultadoCom(saidaPronta()),
    perguntas: [],
    recusadas: 0,
    llmAntesDaPrimeiraPausa: 0,
    propostas: [],
    propostasRecusadas: 0,
    retornosFechados: [],
    juiz: { tentativas: 0, aprovado: null, motivos: [] },
    ...p,
  })

  const passa = (e: ExpectativaDaConversa, r: Partial<Entrada>): boolean => e.confere(entrada(r))

  it("chamouMemoriaPropor confere se memoria.propor foi chamada", () => {
    expect(
      passa(chamouMemoriaPropor(), { resultado: resultadoCom(saidaPronta(), ["memoria.propor"]) }),
    ).toBe(true)
    expect(
      passa(chamouMemoriaPropor(), { resultado: resultadoCom(saidaPronta(), ["lista.propor"]) }),
    ).toBe(false)
  })

  it("blocoComRotina exige memoria.propor com o fato e a primeira letra maiúscula", () => {
    const fato = "vou almoçar fora todo dia"
    expect(
      passa(blocoComRotina(fato), {
        propostas: [proposta("memoria.propor", "Vou almoçar fora todo dia")],
      }),
    ).toBe(true)
    expect(
      passa(blocoComRotina(fato), {
        propostas: [proposta("memoria.propor", "Almoço fora")],
      }),
    ).toBe(false)
    expect(
      passa(blocoComRotina(fato), {
        propostas: [proposta("lista.propor", 'Gengibre na lista "Para ter em casa"')],
      }),
    ).toBe(false)
  })

  it("nenhumaProposta passa sem proposta no bloco e recusa qualquer uma", () => {
    expect(passa(nenhumaProposta(), {})).toBe(true)
    expect(
      passa(nenhumaProposta(), { propostas: [proposta("memoria.propor", "Vou almoçar fora")] }),
    ).toBe(false)
  })

  it("listaNoMaximoUma aceita até uma lista.propor", () => {
    const lista = proposta("lista.propor", 'Gengibre na lista "Para ter em casa"')
    expect(passa(listaNoMaximoUma(), { propostas: [lista] })).toBe(true)
    expect(passa(listaNoMaximoUma(), { propostas: [lista, { ...lista, id: "outra" }] })).toBe(false)
  })

  it("listaSoDe exige que toda lista.propor cite o alimento pelo nome", () => {
    const gengibre = proposta(
      "lista.propor",
      'Gengibre na lista "Para ter em casa" (faltou para o chá)',
    )
    const abobora = proposta(
      "lista.propor",
      'Abóbora na lista "Para ter em casa" (faltou para o chá)',
    )
    expect(passa(listaSoDe("gengibre"), { propostas: [gengibre] })).toBe(true)
    expect(passa(listaSoDe("gengibre"), { propostas: [gengibre, abobora] })).toBe(false)
    expect(passa(listaSoDe("gengibre"), {})).toBe(true)
  })

  it("nenhumaListaAceita recusa qualquer lista.propor no bloco e aceita só as outras", () => {
    const rotina = proposta("memoria.propor", "Vou almoçar fora")
    const lista = proposta("lista.propor", 'Gengibre na lista "Para ter em casa"')
    expect(passa(nenhumaListaAceita(), { propostas: [rotina] })).toBe(true)
    expect(passa(nenhumaListaAceita(), { propostas: [rotina, lista] })).toBe(false)
  })

  it("blocoComRestricao procura a linha da restrição pelo rótulo", () => {
    const linha = proposta("memoria.propor", "Sua alimentação é vegetariana")
    expect(passa(blocoComRestricao("vegetariana"), { propostas: [linha] })).toBe(true)
    expect(passa(blocoComRestricao("vegana"), { propostas: [linha] })).toBe(false)
    expect(passa(blocoComRestricao("vegetariana"), {})).toBe(false)
  })

  it("semAlimentoBarrado recusa sugestão com alimento que a restrição barra", () => {
    // Leite é marcado como vegana e sem lactose na base; abóbora não é barrada por nenhuma delas.
    expect(
      passa(semAlimentoBarrado("vegana"), {
        resultado: resultadoCom(saidaPronta({ sugestoes: [sugestaoCom(["abobora"])] })),
      }),
    ).toBe(true)
    expect(
      passa(semAlimentoBarrado("vegana"), {
        resultado: resultadoCom(saidaPronta({ sugestoes: [sugestaoCom(["leite"])] })),
      }),
    ).toBe(false)
  })

  it("naoDizQueAnotou recusa anotei, guardei, bloco e aprovar no texto da resposta", () => {
    expect(passa(naoDizQueAnotou(), { resultado: resultadoCom(saidaPronta()) })).toBe(true)
    for (const texto of [
      "Anotei isso.",
      "Guardei a rotina.",
      "Vou anotar agora.",
      "Posso anotar isto.",
      "Veja o bloco abaixo.",
      "Pode aprovar.",
    ]) {
      expect(
        passa(naoDizQueAnotou(), { resultado: resultadoCom(saidaPronta({ resposta: texto })) }),
      ).toBe(false)
    }
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
    familia: "aprendizado",
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
    const r = await rodarConversa(casoDeRetorno(), opcoes())

    expect(r.erro).toBeUndefined()
    expect(r.deve).toEqual([{ descricao: "fecha o retorno de ontem pelo título", ok: true }])
    expect(r.naoPode).toEqual([{ descricao: "não fecha o chá, que segue pendente", ok: true }])
  })

  it("o resultado leva a família do caso", async () => {
    const r = await rodarConversa(casoDeRetorno(), opcoes())
    expect(r.familia).toBe("aprendizado")
  })
})

describe("expectativas de Aprendizado e Para ter em casa", () => {
  type Entrada = Parameters<ExpectativaDaConversa["confere"]>[0]

  const saidaPronta = (p: Partial<SaidaDoAcompanhante> = {}): SaidaDoAcompanhante => ({
    origem: "agente",
    resposta: "Um prato morno, sem tela.",
    geral: false,
    avisos: [],
    explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
    sugestoes: [],
    evitar: [],
    incertos: [],
    citados: [],
    anotacoes: [],
    propostas: [],
    ...p,
  })

  const sugestao = (
    tipo: SugestaoEntregue["tipo"],
    ids: string[],
    extra: Partial<SugestaoEntregue> = {},
  ): SugestaoEntregue => ({
    tipo,
    titulo: "Sugestão",
    como_fazer: "Prepare e sirva.",
    motivo: "Esquenta.",
    linhas_base: [],
    novidade: false,
    verbos: [],
    itens: ids.map((id) => ({
      alimento_id: id,
      nome: id,
      contribui: [],
      verbos: [],
      linha_base: `alimentos:${id}`,
      casa: "confirmado",
    })),
    ...extra,
  })

  const resultadoCom = (saida: SaidaDoAcompanhante, tools: string[] = []): ResultadoDoRun => ({
    saida,
    status: "done",
    tools,
    chamadasDeModelo: 1,
    validacoes: ["ok"],
  })

  const entrada = (p: Partial<Entrada> = {}): Entrada => ({
    resposta: { run_id: "run-eval", status: "done", caminho: "acompanhante" },
    resultado: resultadoCom(saidaPronta()),
    perguntas: [],
    recusadas: 0,
    llmAntesDaPrimeiraPausa: 0,
    propostas: [],
    propostasRecusadas: 0,
    retornosFechados: [],
    juiz: { tentativas: 0, aprovado: null, motivos: [] },
    ...p,
  })

  const passa = (e: ExpectativaDaConversa, r: Partial<Entrada>): boolean => e.confere(entrada(r))

  const paraTer = {
    alimento_id: "cardamomo",
    nome: "Cardamomo",
    vezes: 3,
    contribui: [],
    linha_base: "alimentos:cardamomo",
    verbos: [],
    motivo: "Faltou três vezes.",
  }

  it("primeiroDoTipoNao reprova o chá dado quando ele é o primeiro do seu tipo", () => {
    const outroPrimeiro = saidaPronta({
      sugestoes: [
        sugestao("cha", ["cardamomo"], { pratica_id: "cha-cardamomo" }),
        sugestao("cha", ["gengibre"], { pratica_id: "cha-gengibre-canela" }),
      ],
    })
    const primeiro = saidaPronta({
      sugestoes: [sugestao("cha", ["gengibre"], { pratica_id: "cha-gengibre-canela" })],
    })
    const exp = primeiroDoTipoNao("cha-gengibre-canela", "cha")
    expect(passa(exp, { resultado: resultadoCom(outroPrimeiro) })).toBe(true)
    expect(passa(exp, { resultado: resultadoCom(primeiro) })).toBe(false)
  })

  it("apareceNasSugestoes exige o alimento num item de sugestão", () => {
    const exp = apareceNasSugestoes("gengibre")
    expect(
      passa(exp, {
        resultado: resultadoCom(saidaPronta({ sugestoes: [sugestao("cha", ["gengibre"])] })),
      }),
    ).toBe(true)
    expect(
      passa(exp, {
        resultado: resultadoCom(saidaPronta({ sugestoes: [sugestao("cha", ["canela"])] })),
      }),
    ).toBe(false)
  })

  it("naoAparece reprova o alimento que sai num item, e passa quando ele não sai", () => {
    const exp = naoAparece("gengibre")
    expect(
      passa(exp, {
        resultado: resultadoCom(
          saidaPronta({
            resposta: "Uma refeição morna.",
            sugestoes: [sugestao("cha", ["canela"])],
          }),
        ),
      }),
    ).toBe(true)
    expect(
      passa(exp, {
        resultado: resultadoCom(saidaPronta({ sugestoes: [sugestao("cha", ["gengibre"])] })),
      }),
    ).toBe(false)
  })

  it("chamouResultadoRegistrar confere se resultado.registrar foi chamada", () => {
    const exp = chamouResultadoRegistrar()
    expect(passa(exp, { resultado: resultadoCom(saidaPronta(), ["resultado.registrar"]) })).toBe(
      true,
    )
    expect(passa(exp, { resultado: resultadoCom(saidaPronta(), ["memoria.propor"]) })).toBe(false)
  })

  it("fechouRetorno exige o título nos retornos fechados", () => {
    const exp = fechouRetorno("Arroz")
    expect(passa(exp, { retornosFechados: ["Arroz"] })).toBe(true)
    expect(passa(exp, { retornosFechados: ["Chá"] })).toBe(false)
  })

  it("naoFechou reprova o título que saiu dos pendentes", () => {
    const exp = naoFechou("Chá")
    expect(passa(exp, { retornosFechados: ["Arroz"] })).toBe(true)
    expect(passa(exp, { retornosFechados: ["Chá"] })).toBe(false)
  })

  it("nenhumRetornoFechado reprova quando algum retorno fechou", () => {
    const exp = nenhumRetornoFechado()
    expect(passa(exp, { retornosFechados: [] })).toBe(true)
    expect(passa(exp, { retornosFechados: ["Arroz"] })).toBe(false)
  })

  it("reconheceRetorno exige o retorno na primeira frase", () => {
    const exp = reconheceRetorno()
    expect(
      passa(exp, {
        resultado: resultadoCom(
          saidaPronta({ resposta: "Que bom que o arroz ajudou ontem. Agora, um chá." }),
        ),
      }),
    ).toBe(true)
    expect(
      passa(exp, {
        resultado: resultadoCom(
          saidaPronta({ resposta: "Para agora, um chá quente de gengibre. Ok." }),
        ),
      }),
    ).toBe(false)
  })

  it("apontaComoFicou exige o texto com Como ficou", () => {
    const exp = apontaComoFicou()
    expect(
      passa(exp, { resultado: resultadoCom(saidaPronta({ resposta: "Como ficou aquilo?" })) }),
    ).toBe(true)
    expect(
      passa(exp, {
        resultado: resultadoCom(saidaPronta({ resposta: "Que bom, vou tomar um chá." })),
      }),
    ).toBe(false)
  })

  it("comParaTer exige o para_ter na saída", () => {
    const exp = comParaTer()
    expect(passa(exp, { resultado: resultadoCom(saidaPronta({ para_ter: paraTer })) })).toBe(true)
    expect(passa(exp, { resultado: resultadoCom(saidaPronta()) })).toBe(false)
  })

  it("semParaTer reprova quando há para_ter na saída", () => {
    const exp = semParaTer()
    expect(passa(exp, { resultado: resultadoCom(saidaPronta()) })).toBe(true)
    expect(passa(exp, { resultado: resultadoCom(saidaPronta({ para_ter: paraTer })) })).toBe(false)
  })

  it("falaDasProximasVezes exige a palavra próxima no texto", () => {
    const exp = falaDasProximasVezes()
    expect(
      passa(exp, {
        resultado: resultadoCom(saidaPronta({ resposta: "Vale ter para as próximas vezes." })),
      }),
    ).toBe(true)
    expect(
      passa(exp, { resultado: resultadoCom(saidaPronta({ resposta: "Vale ter em casa." })) }),
    ).toBe(false)
  })

  it("semFraseDeCompra reprova comprar, loja, mercado, preço, marca e R$", () => {
    const exp = semFraseDeCompra()
    expect(
      passa(exp, {
        resultado: resultadoCom(
          saidaPronta({ resposta: "Um chá quente, para as próximas vezes." }),
        ),
      }),
    ).toBe(true)
    for (const texto of [
      "Vale comprar cardamomo.",
      "Vá à loja.",
      "Compre no mercado.",
      "Qual o preço?",
      "Uma marca boa.",
      "Custa R$ 10.",
    ]) {
      expect(passa(exp, { resultado: resultadoCom(saidaPronta({ resposta: texto })) })).toBe(false)
    }
  })
})

describe("filtro de casos por id (--casos)", () => {
  it("devolve só os casos pedidos, na ordem do checkpoint, não na ordem dos ids", () => {
    const linhas = listarCasos("c2-conversa", ["c2-01-frio-sem-fome", "c1-08-casa-so-incertos"])

    expect(linhas.map((l) => l.id)).toEqual(["c1-08-casa-so-incertos", "c2-01-frio-sem-fome"])
  })

  it("sem ids, lista os 54 casos", () => {
    expect(listarCasos("c2-conversa")).toHaveLength(54)
    expect(listarCasos("c2-conversa", undefined)).toHaveLength(54)
  })

  it("id desconhecido dá erro com a lista dos ids válidos", () => {
    expect(() =>
      casosDoCheckpoint("c2-conversa", ["c1-08-casa-so-incertos", "nao-existe"]),
    ).toThrow(/nao-existe[\s\S]*c1-01-frio-agitada/)
  })

  it("id de outro checkpoint também é desconhecido", () => {
    expect(() => listarCasos("c1-base", ["c2-01-frio-sem-fome"])).toThrow(/c2-01-frio-sem-fome/)
  })

  it("separa os ids por vírgula e ignora espaços e itens vazios", () => {
    expect(idsDeCasos("a, b,,c ,")).toEqual(["a", "b", "c"])
  })
})

describe("arquivo do relatório", () => {
  it("rodada inteira grava <checkpoint>.md", () => {
    expect(arquivoDoRelatorio("c2-conversa", false)).toBe("evals/resultados/c2-conversa.md")
  })

  it("rodada parcial grava <checkpoint>-parcial.md e nunca o da rodada inteira", () => {
    expect(arquivoDoRelatorio("c2-conversa", true)).toBe("evals/resultados/c2-conversa-parcial.md")
  })
})

describe("Intérprete sem o registro de uso do container", () => {
  it("roda só com cliente, base e relógio: o roteador usa o registro em memória", async () => {
    const container = createContainer()
    const ledgerDoContainer = vi.spyOn(container.ledger, "registrarRateLimit")
    const llm = createFakeLlm([saidaDoInterprete])

    const r = await rodarInterprete(casoInterprete, {
      client: llm,
      kb: container.knowledge,
      clock: createFixedClock(AGORA),
    })

    expect(r.erro).toBeUndefined()
    expect(r.modelos).toHaveLength(1)
    expect(ledgerDoContainer).not.toHaveBeenCalled()
  })
})

// c1-08 e c1-11 deram `Error` no eval real: o agente pausou para perguntar (ask_user) e o runner exigia saída
// na primeira resposta ("pausou sem saída"). O runner passa a responder a pausa, como o da conversa.
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

    const r = await rodarAcompanhante(caso, {
      runtime: createScriptedRuntime(roteiroComPausa(pedido)),
    })

    expect(r.perguntas).toBe(1)
    expect(r.base.erro).toBeUndefined()
    expect(r.base.tipo).toBe("acompanhante")
    expect(r.r.saida.resposta.length).toBeGreaterThan(0)
  })

  it("sem pausa, devolve o caso com zero perguntas", async () => {
    const caso = casosC1.find((c) => c.id === "c1-11-sem-cidade")
    if (!caso) throw new Error("caso ausente")

    const r = await rodarAcompanhante(caso, {
      runtime: createScriptedRuntime(roteiroComPausa({}).filter((_, i) => i !== 1)),
    })

    expect(r.perguntas).toBe(0)
  })

  it("pausa além do teto de retomadas falha o caso com RituError pausa_acima_do_teto", async () => {
    const caso = casosC1.find((c) => c.id === "c1-08-casa-so-incertos")
    if (!caso) throw new Error("caso ausente")
    const pergunta = (alimento: string) => ({
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

describe("checagem do juiz da Memória", () => {
  it("fiel vira ok; não fiel reprova; sem chamada fica não avaliada e reprova", () => {
    expect(checagemDoJuiz(true)).toEqual({
      descricao: "Nada fora das notas (juiz do eval)",
      ok: true,
    })
    expect(checagemDoJuiz(false)).toEqual({
      descricao: "Nada fora das notas (juiz do eval)",
      ok: false,
    })
    expect(checagemDoJuiz(undefined)).toEqual({
      descricao: "Nada fora das notas (juiz do eval, não avaliada)",
      ok: false,
    })
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

describe("runner do Juiz com LLM falso", () => {
  const clock = createFixedClock(AGORA)
  const kb = createContainer().knowledge

  it("roda o caso, confere deve e naoPode sobre o veredito e marca a família", async () => {
    const llm = createFakeLlm([
      { apontamentos: [{ motivo: "promessa", trecho: "Isso cura a dor." }] },
    ])
    const r = await rodarJuiz(casoJuiz, { client: llm, kb, clock })

    expect(r.tipo).toBe("juiz")
    expect(r.familia).toBe("juiz")
    expect(r.erro).toBeUndefined()
    expect(r.deve).toEqual([{ descricao: "aponta a promessa", ok: true }])
    expect(r.naoPode).toEqual([{ descricao: "não aprova", ok: true }])
    expect(r.motivosEsperados).toEqual(["promessa"])
    expect(r.motivosApontados).toEqual(["promessa"])
    expect(r.boa).toBe(false)
    expect(r.juiz).toEqual({ tentativas: 1, aprovado: false, motivos: ["promessa"] })
    expect(r.uso.apoio?.chamadas).toBe(1)
  })

  it("resposta sem apontamento conta como aprovada e marca boa quando o caso pede", async () => {
    const llm = createFakeLlm([{ apontamentos: [] }])
    const r = await rodarJuiz(
      { ...casoJuiz, boa: true, motivos: [], deve: [], naoPode: [] },
      { client: llm, kb, clock },
    )

    expect(r.boa).toBe(true)
    expect(r.juiz?.aprovado).toBe(true)
    expect(r.motivosApontados).toEqual([])
  })

  it("Juiz sem resposta conta como caso falho com o motivo, e as checagens falham", async () => {
    const llm = createFakeLlm([{ erro: "indisponivel" }])
    const r = await rodarJuiz(casoJuiz, { client: llm, kb, clock })

    expect(r.erro).toBeDefined()
    expect(r.deve.every((x) => !x.ok)).toBe(true)
    expect(r.naoPode.every((x) => !x.ok)).toBe(true)
  })
})

describe("runner da Memória com LLM falso", () => {
  const kb = createMiniKnowledge()

  it("roda o resumo pelo agente, confere deve e naoPode e grava o uso do apoio", async () => {
    const clock = createFixedClock(AGORA)
    const llm = createFakeLlm([{ resumo: "Você almoça fora durante a semana." }])

    const r = await rodarMemoria(casoMemoria, { client: llm, kb, clock })

    expect(r.tipo).toBe("memoria")
    expect(r.familia).toBe("memoria")
    expect(r.origem).toBe("modelo")
    expect(r.erro).toBeUndefined()
    expect(r.deve).toEqual([{ descricao: "junta as repetidas", ok: true }])
    expect(r.naoPode).toEqual([{ descricao: "não inventa diagnóstico", ok: true }])
    expect(r.validaNa1a).toBe(true)
    expect(r.uso.apoio).toEqual({ chamadas: 1, tokens_entrada: 10, tokens_saida: 5 })
    expect(r.modelos).toHaveLength(1)
  })

  it("as notas entram com o dia calculado pelo relógio: agora menos os dias atrás", async () => {
    const clock = createFixedClock(AGORA)
    const llm = createFakeLlm([{ resumo: "Você almoça fora." }])

    await rodarMemoria(casoMemoria, { client: llm, kb, clock })

    const [pedido] = llm.pedidos as { entrada: string }[]
    expect(pedido?.entrada).toContain("1. (2026-06-05) almoço fora na semana")
    expect(pedido?.entrada).toContain("2. (2026-06-12) almoço fora de segunda a sexta")
  })

  it("resposta sem resumo válido cai no código: origem codigo, e a validação não conta como primeira", async () => {
    const llm = createFakeLlm([{ resumo: "   " }])

    const r = await rodarMemoria(casoMemoria, { client: llm, kb, clock: createFixedClock(AGORA) })

    expect(r.origem).toBe("codigo")
    expect(r.validaNa1a).toBe(false)
    expect(r.deve).toEqual([{ descricao: "junta as repetidas", ok: true }])
  })

  it("fila vazia do fake não derruba o caso: também cai no código", async () => {
    const r = await rodarMemoria(casoMemoria, {
      client: createFakeLlm([]),
      kb,
      clock: createFixedClock(AGORA),
    })

    expect(r.origem).toBe("codigo")
    expect(r.erro).toBeUndefined()
  })

  it("caso com juiz sem juiz injetado: a checagem sai como não avaliada", async () => {
    const llm = createFakeLlm([{ resumo: "Você almoça fora." }])

    const r = await rodarMemoria(
      { ...casoMemoria, juiz: true },
      { client: llm, kb, clock: createFixedClock(AGORA) },
    )

    expect(r.deve.at(-1)).toEqual({
      descricao: "Nada fora das notas (juiz do eval, não avaliada)",
      ok: false,
    })
  })

  it("caso com juiz: a resposta fiel vira a última checagem e soma o uso do apoio", async () => {
    const llm = createFakeLlm([{ resumo: "Você almoça fora." }])
    const juiz = async () => ({
      fiel: true,
      modelo: "modelo-do-juiz",
      tokens: { entrada: 7, saida: 2 },
      trocas: 0,
    })

    const r = await rodarMemoria(
      { ...casoMemoria, juiz: true },
      { client: llm, kb, clock: createFixedClock(AGORA), juiz },
    )

    expect(r.deve.at(-1)).toEqual({ descricao: "Nada fora das notas (juiz do eval)", ok: true })
    expect(r.uso.apoio).toEqual({ chamadas: 2, tokens_entrada: 17, tokens_saida: 7 })
    expect(r.modelos).toContain("modelo-do-juiz")
  })

  it("juiz que acha fato fora das notas reprova a checagem", async () => {
    const llm = createFakeLlm([{ resumo: "Você almoça fora." }])
    const juiz = async () => ({
      fiel: false,
      modelo: "modelo-do-juiz",
      tokens: { entrada: 7, saida: 2 },
      trocas: 0,
    })

    const r = await rodarMemoria(
      { ...casoMemoria, juiz: true },
      { client: llm, kb, clock: createFixedClock(AGORA), juiz },
    )

    expect(r.deve.at(-1)?.ok).toBe(false)
  })
})
