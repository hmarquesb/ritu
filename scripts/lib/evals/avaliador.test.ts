import { llmCotas } from "@config/llm-cotas"
import { describe, expect, it } from "vitest"
import type { CasoDeEval } from "../../../evals/llm/casos"
import type {
  SaidaDoAcompanhante,
  SugestaoEntregue,
} from "../../../src/core/agents/companion/saida"
import { SemModeloError } from "../../../src/core/llm/chamar"
import { createModelRouter } from "../../../src/core/llm/router"
import { createFakeLlm } from "../../../src/infra/fakes/fake-llm"
import { createFixedClock } from "../../../src/infra/fakes/fixed-clock"
import { createMemoryLedger } from "../../../src/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "../../../src/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "../../../src/infra/fakes/mini-knowledge"
import {
  aplicarAvaliacao,
  avaliar,
  montarEntradaDoAvaliador,
  montarPerguntas,
  type Pergunta,
} from "./avaliador"
import type { ResultadoDoCaso } from "./resultado"

const kb = createMiniKnowledge()

function casoCom(parcial: {
  id?: string
  familias?: string[]
  criterios?: unknown[]
  tipo?: string
}) {
  return {
    id: parcial.id ?? "caso-x",
    titulo: "Caso de teste",
    tipo: parcial.tipo ?? "conversa",
    familias: parcial.familias ?? [],
    criterios: parcial.criterios,
  } as unknown as CasoDeEval
}

const SAIDA_BASE: SaidaDoAcompanhante = {
  origem: "agente",
  resposta: "",
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

function sugestao(parcial: Partial<SugestaoEntregue>): SugestaoEntregue {
  return {
    tipo: "cha",
    titulo: "Chá de gengibre com canela",
    como_fazer: "",
    itens: [],
    verbos: [],
    motivo: "Aquece e combina com o frio.",
    linhas_base: [],
    novidade: false,
    ...parcial,
  } as SugestaoEntregue
}

function item(nome: string, linha_base: string): SugestaoEntregue["itens"][number] {
  return { alimento_id: nome, nome, contribui: [], verbos: [], linha_base, casa: "confirmado" }
}

const CRITERIO = {
  descricao: "não promete cura",
  pergunta: "O texto promete cura?",
  esperado: false,
}

describe("montarPerguntas", () => {
  it("família explicacao com saída do agente traz as três perguntas fixas", () => {
    const perguntas = montarPerguntas(casoCom({ familias: ["explicacao"] }), SAIDA_BASE)
    expect(perguntas.map((p) => [p.n, p.origem, p.indice])).toEqual([
      [1, "explicacao", 0],
      [2, "explicacao", 1],
      [3, "explicacao", 2],
    ])
  })

  it("família fidelidade traz o texto e um motivo por sugestão com linha citada", () => {
    const saida: SaidaDoAcompanhante = {
      ...SAIDA_BASE,
      sugestoes: [
        sugestao({ linhas_base: ["alimentos:gengibre"] }),
        sugestao({ itens: [item("canela", "alimentos:canela")] }),
        sugestao({ linhas_base: [], itens: [] }),
      ],
    }
    const perguntas = montarPerguntas(casoCom({ familias: ["fidelidade"] }), saida)
    expect(perguntas.map((p) => [p.origem, p.indice])).toEqual([
      ["texto_bate", undefined],
      ["motivo", 0],
      ["motivo", 1],
    ])
    expect(perguntas[1]?.pergunta).toBe(
      "O motivo da sugestão 1 diz o mesmo que as linhas da base citadas nela?",
    )
  })

  it("saída segura não ganha pergunta fixa, mesmo com a família", () => {
    const saida: SaidaDoAcompanhante = { ...SAIDA_BASE, origem: "segura" }
    const perguntas = montarPerguntas(casoCom({ familias: ["explicacao", "fidelidade"] }), saida)
    expect(perguntas).toEqual([])
  })

  it("critérios vêm depois das fixas, na ordem, com o índice da posição", () => {
    const caso = casoCom({
      familias: ["explicacao"],
      criterios: [CRITERIO, { ...CRITERIO, pergunta: "Segundo?" }],
    })
    const perguntas = montarPerguntas(caso, SAIDA_BASE)
    expect(perguntas.map((p) => [p.n, p.origem, p.indice])).toEqual([
      [1, "explicacao", 0],
      [2, "explicacao", 1],
      [3, "explicacao", 2],
      [4, "criterio", 0],
      [5, "criterio", 1],
    ])
    expect(perguntas[3]?.pergunta).toBe(CRITERIO.pergunta)
  })

  it("critério vale em caso de memória, sem saída", () => {
    const caso = casoCom({ tipo: "memoria", familias: ["memoria"], criterios: [CRITERIO] })
    const perguntas = montarPerguntas(caso)
    expect(perguntas).toEqual([
      expect.objectContaining({ n: 1, origem: "criterio", indice: 0, pergunta: CRITERIO.pergunta }),
    ])
  })
})

describe("montarEntradaDoAvaliador", () => {
  const perguntas: Pergunta[] = [{ n: 1, origem: "criterio", indice: 0, pergunta: "Pergunta um?" }]

  it("monta os blocos na ordem, sem bloco vazio, e troca < e > do conteúdo", () => {
    const entrada = montarEntradaDoAvaliador({
      mensagem: "",
      texto: "Tome <script>x</script> com calma.",
      kb,
      perguntas,
    })
    expect(entrada).toBe(
      [
        "<resposta>",
        "Tome ‹script›x‹/script› com calma.",
        "</resposta>",
        "",
        "<perguntas>",
        "1. Pergunta um?",
        "</perguntas>",
      ].join("\n"),
    )
  })

  it("mensagem entra antes da resposta e sugestões trazem só as linhas que resolvem", () => {
    const saida: SaidaDoAcompanhante = {
      ...SAIDA_BASE,
      sugestoes: [
        sugestao({
          titulo: "Chá quente",
          motivo: "Aquece.",
          linhas_base: ["alimentos:gengibre", "alimentos:nao_existe"],
          itens: [item("gengibre", "alimentos:gengibre")],
        }),
      ],
    }
    const entrada = montarEntradaDoAvaliador({
      mensagem: "estou com frio",
      texto: "Um chá quente ajuda.",
      saida,
      kb,
      perguntas,
    })
    const linhaGengibre = `alimentos:gengibre: ${kb.alimento("gengibre")?.nome ?? ""}`
    expect(entrada.startsWith("<mensagem>\nestou com frio\n</mensagem>\n\n<resposta>")).toBe(true)
    expect(entrada).toContain("<sugestoes>\n1. Chá quente")
    expect(entrada).toContain(linhaGengibre)
    expect(entrada.split("alimentos:gengibre:").length).toBe(2)
    expect(entrada).not.toContain("alimentos:nao_existe")
  })
})

describe("avaliar", () => {
  const caso = casoCom({ familias: ["explicacao"], criterios: [CRITERIO] })
  const colhido = { texto: "Resposta curta.", saida: SAIDA_BASE, etapas: [] }

  function setup(respostas: unknown[]) {
    const clock = createFixedClock("2026-06-01T20:00:10Z")
    const ledger = createMemoryLedger(clock, {})
    const telemetry = createMemoryTelemetry()
    const router = createModelRouter({ ledger, clock, telemetry })
    const client = createFakeLlm(respostas)
    return { deps: { router, client, telemetry, clock, kb }, client }
  }

  it("devolve as respostas por número, sem as faltantes nem as repetidas", async () => {
    const { deps } = setup([
      {
        respostas: [
          { n: 1, sim: true },
          { n: 2, sim: false },
          { n: 4, sim: true },
          { n: 4, sim: false },
        ],
      },
    ])
    const r = await avaliar(deps, caso, colhido)
    if ("naoAvaliado" in r) throw new Error("esperava avaliação")
    expect([...r.respostas.entries()]).toEqual([
      [1, true],
      [2, false],
    ])
    expect(r.uso).toEqual({ chamadas: 1, tokens_entrada: 10, tokens_saida: 5 })
    expect(r.modelo).toBe(llmCotas.papeis.apoio[0])
  })

  it("erro que não é rate_limit vira naoAvaliado", async () => {
    const { deps } = setup([{ erro: "timeout" }])
    const r = await avaliar(deps, caso, colhido)
    expect(r).toEqual({ naoAvaliado: true })
  })

  it("rate_limit em todos os modelos de apoio lança", async () => {
    const voltas = llmCotas.papeis.apoio.length + 2
    const { deps } = setup(Array.from({ length: voltas }, () => ({ erro: "rate_limit" })))
    await expect(avaliar(deps, caso, colhido)).rejects.toBeInstanceOf(SemModeloError)
  })
})

function resultadoBase(parcial: Partial<ResultadoDoCaso> = {}): ResultadoDoCaso {
  return {
    id: "caso-x",
    titulo: "Caso",
    tipo: "conversa",
    familias: ["explicacao"],
    marcas: [],
    checagens: [{ lista: "deve", descricao: "fala do momento", ok: true }],
    acertou: true,
    estado: "acertou",
    uso: {},
    trocas: 0,
    latenciaMs: 10,
    modelos: ["modelo-principal"],
    ...parcial,
  }
}

const PERGUNTAS_COM_CRITERIO: Pergunta[] = [
  { n: 1, origem: "explicacao", indice: 0, pergunta: "E0?" },
  { n: 2, origem: "explicacao", indice: 1, pergunta: "E1?" },
  { n: 3, origem: "explicacao", indice: 2, pergunta: "E2?" },
  { n: 4, origem: "texto_bate", pergunta: "T?" },
  { n: 5, origem: "motivo", indice: 1, pergunta: "M1?" },
  { n: 6, origem: "criterio", indice: 0, pergunta: CRITERIO.pergunta, criterio: CRITERIO },
]

describe("aplicarAvaliacao", () => {
  it("critério esperado falso respondido não dá ok", () => {
    const r = aplicarAvaliacao(resultadoBase(), PERGUNTAS_COM_CRITERIO, {
      respostas: new Map([
        [1, true],
        [2, true],
        [3, true],
        [4, true],
        [5, true],
        [6, false],
      ]),
      uso: { chamadas: 1, tokens_entrada: 10, tokens_saida: 5 },
      trocas: 0,
      modelo: "modelo-apoio",
    })
    const criterio = r.checagens.find((c) => c.lista === "criterio")
    expect(criterio).toEqual({ lista: "criterio", descricao: CRITERIO.descricao, ok: true })
    expect(r.acertou).toBe(true)
    expect(r.avaliacao).toEqual({
      explicacao: [true, true, true],
      textoBate: true,
      motivos: [null, true],
    })
    expect(r.usoDoAvaliador).toEqual({ chamadas: 1, tokens_entrada: 10, tokens_saida: 5 })
    expect(r.modelos).toEqual(["modelo-principal", "modelo-apoio"])
  })

  it("resposta contrária ao esperado reprova o caso", () => {
    const r = aplicarAvaliacao(resultadoBase(), PERGUNTAS_COM_CRITERIO, {
      respostas: new Map([[6, true]]),
      uso: { chamadas: 1, tokens_entrada: 1, tokens_saida: 1 },
      trocas: 1,
      modelo: "modelo-principal",
    })
    expect(r.checagens.find((c) => c.lista === "criterio")?.ok).toBe(false)
    expect(r.acertou).toBe(false)
    expect(r.trocas).toBe(1)
    expect(r.modelos).toEqual(["modelo-principal"])
  })

  it("avaliação que falhou deixa as respostas como null", () => {
    const r = aplicarAvaliacao(resultadoBase(), PERGUNTAS_COM_CRITERIO, { naoAvaliado: true })
    expect(r.avaliacao).toEqual({
      explicacao: [null, null, null],
      textoBate: null,
      motivos: [null, null],
    })
    expect(r.checagens.find((c) => c.lista === "criterio")?.ok).toBeNull()
    expect(r.usoDoAvaliador).toBeUndefined()
  })
})
