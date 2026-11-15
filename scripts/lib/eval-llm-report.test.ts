import { describe, expect, it } from "vitest"
import { casosC1 } from "../../evals/llm/casos/c1"
import { semPalavrasInteiras, trazGuna } from "../../evals/llm/casos/c1/expectativas"
import type { ResultadoDoRun } from "../../evals/llm/casos/c1/tipos"
import { entradaDoAcompanhanteSchema } from "../../src/core/agents/companion/entrada"
import type { SaidaDoAcompanhante } from "../../src/core/agents/companion/saida"
import type { Guna } from "../../src/core/knowledge/vocab"
import { montarCenario } from "../../test/fixtures/cenarios"
import {
  formatarRelatorio,
  percentil,
  porcentagem,
  type ResultadoDoCaso,
  resumir,
} from "./eval-llm-report"

type Sugestao = SaidaDoAcompanhante["sugestoes"][number]

function runDe(saida: Partial<SaidaDoAcompanhante>): ResultadoDoRun {
  return {
    saida: {
      origem: "agente",
      resposta: "",
      geral: false,
      avisos: [],
      explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
      sugestoes: [],
      evitar: [],
      incertos: [],
      citados: [],
      ...saida,
    },
    status: "done",
    tools: [],
    chamadasDeModelo: 1,
    validacoes: ["ok"],
  }
}

function sugestaoCom(alimentos: string[], contribui: Guna[] = []): Sugestao {
  return {
    tipo: "cha",
    titulo: "Chá",
    como_fazer: "Ferva e coa.",
    motivo: "Motivo",
    verbos: [],
    linhas_base: [],
    novidade: false,
    itens: alimentos.map((alimento_id) => ({
      alimento_id,
      nome: alimento_id,
      contribui,
      verbos: [],
      linha_base: "",
      casa: "confirmado",
    })),
  }
}

function casoPorId(id: string) {
  const achado = casosC1.find((c) => c.id === id)
  if (!achado) throw new Error(`caso ${id} ausente`)
  return achado
}

describe("trazGuna", () => {
  it("não passa só com qualidades_buscadas: precisa de item sugerido que contribui", () => {
    const r = runDe({
      sugestoes: [sugestaoCom(["gengibre"], [])],
      explicacao: { qualidades_do_momento: [], qualidades_buscadas: ["leve"] },
    })
    expect(trazGuna("Algo leve", ["leve"]).confere(r)).toBe(false)
  })

  it("passa quando um item sugerido contribui a qualidade", () => {
    const r = runDe({ sugestoes: [sugestaoCom(["gengibre"], ["leve"])] })
    expect(trazGuna("Algo leve", ["leve"]).confere(r)).toBe(true)
  })
})

describe("semPalavrasInteiras", () => {
  it("procura e contrata não disparam cura nem trata", () => {
    const proibidas = ["trata", "cura"]
    expect(
      semPalavrasInteiras("x", proibidas).confere(runDe({ resposta: "Você procura um chá." })),
    ).toBe(true)
    expect(
      semPalavrasInteiras("x", proibidas).confere(runDe({ resposta: "Ela contrata ajuda." })),
    ).toBe(true)
  })

  it("cura isolada dispara", () => {
    const proibidas = ["trata", "cura"]
    expect(semPalavrasInteiras("x", proibidas).confere(runDe({ resposta: "Isso é a cura." }))).toBe(
      false,
    )
  })

  it("caso 12 usa a variante por palavra inteira na promessa de tratamento", () => {
    const naoPode = casoPorId("c1-12-estomago-pesado").naoPode
    const ok = runDe({ resposta: "Um chá morno ajuda a procurar conforto." })
    const ruim = runDe({ resposta: "Este chá trata o estômago." })
    expect(naoPode.every((e) => e.confere(ok))).toBe(true)
    expect(naoPode.every((e) => e.confere(ruim))).toBe(false)
  })
})

describe("caso 03, nada doce na parte estruturada", () => {
  it("mel como ingrediente sugerido falha", () => {
    const naoPode = casoPorId("c1-03-pesada-depois-do-almoco").naoPode
    const comMel = runDe({ sugestoes: [sugestaoCom(["mel"])] })
    expect(naoPode.every((e) => e.confere(comMel))).toBe(false)
  })

  it("sem adoçante entre os itens continua passando", () => {
    const naoPode = casoPorId("c1-03-pesada-depois-do-almoco").naoPode
    const semDoce = runDe({ sugestoes: [sugestaoCom(["gengibre", "hortela"])] })
    expect(naoPode.every((e) => e.confere(semDoce))).toBe(true)
  })
})

function caso(parcial: Partial<ResultadoDoCaso> & { id: string }): ResultadoDoCaso {
  return {
    titulo: "t",
    deve: [{ descricao: "a", ok: true }],
    naoPode: [{ descricao: "b", ok: true }],
    trajetoriaOk: true,
    chamadasDesnecessarias: 0,
    validaNa1a: true,
    houveViolacao: false,
    corrigiuAposViolacao: false,
    explicacao: {
      diz_o_que_o_momento_pede: true,
      diz_o_que_cada_item_traz: true,
      texto_bate_com_sugestoes: true,
    },
    uso: {
      decisao: { chamadas: 3, tokens_entrada: 1000, tokens_saida: 200 },
      apoio: { chamadas: 1, tokens_entrada: 300, tokens_saida: 20 },
    },
    trocas: 0,
    latenciaMs: 1000,
    modelos: ["gemini-3.5-flash-lite"],
    ...parcial,
  }
}

describe("percentil", () => {
  it("usa o posto mais próximo", () => {
    const v = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    expect(percentil(v, 50)).toBe(50)
    expect(percentil(v, 95)).toBe(100)
  })
  it("vazio dá zero e um valor dá ele mesmo", () => {
    expect(percentil([], 50)).toBe(0)
    expect(percentil([7], 95)).toBe(7)
  })
  it("não depende da ordem de entrada", () => {
    expect(percentil([30, 10, 20], 50)).toBe(20)
  })
})

describe("porcentagem", () => {
  it("arredonda e trata total zero", () => {
    expect(porcentagem(1, 3)).toBe("33%")
    expect(porcentagem(0, 0)).toBe("n/d")
  })
})

describe("resumir", () => {
  const casos = [
    caso({ id: "a", latenciaMs: 1000 }),
    caso({
      id: "b",
      latenciaMs: 3000,
      deve: [{ descricao: "x", ok: false }],
      trajetoriaOk: false,
      chamadasDesnecessarias: 2,
      validaNa1a: false,
      houveViolacao: true,
      corrigiuAposViolacao: true,
      trocas: 1,
      modelos: ["gemini-3.1-flash-lite"],
    }),
    caso({ id: "c", houveViolacao: true, corrigiuAposViolacao: false, explicacao: undefined }),
  ]
  const r = resumir(casos)

  it("conta conteúdo, trajetória, validação e correção", () => {
    expect(r.casos).toBe(3)
    expect(r.conteudoDeve).toBe(2)
    expect(r.conteudoNaoPode).toBe(3)
    expect(r.trajetoriaCorreta).toBe(2)
    expect(r.chamadasDesnecessarias).toBe(2)
    expect(r.validaNa1a).toBe(2)
    expect(r.comViolacao).toBe(2)
    expect(r.corrigiuAposViolacao).toBe(1)
    expect(r.comExplicacao).toBe(2)
    expect(r.explicacaoCompleta).toBe(2)
  })

  it("soma custo por papel, trocas e modelos, com p50 e p95 da latência", () => {
    expect(r.uso.decisao).toEqual({ chamadas: 9, tokens_entrada: 3000, tokens_saida: 600 })
    expect(r.uso.apoio?.chamadas).toBe(3)
    expect(r.trocas).toBe(1)
    expect(r.modelos).toEqual(["gemini-3.1-flash-lite", "gemini-3.5-flash-lite"])
    expect(r.latenciaP50).toBe(1000)
    expect(r.latenciaP95).toBe(3000)
  })
})

describe("formatarRelatorio", () => {
  const rodada = {
    checkpoint: "c1-base",
    promptVersao: "acompanhante.v1",
    totalDeCasos: 12,
    interrompidaPor: "rate_limit",
    casos: [
      caso({ id: "c1-01" }),
      caso({ id: "c1-02", deve: [{ descricao: "Algo que refresca", ok: false }] }),
    ],
  }
  const texto = formatarRelatorio(rodada)

  it("traz o cabeçalho com versão do prompt, modelos e a interrupção", () => {
    expect(texto).toContain("# Eval com LLM: c1-base")
    expect(texto).toContain("Versão do prompt: acompanhante.v1")
    expect(texto).toContain("Modelos usados: gemini-3.5-flash-lite")
    expect(texto).toContain("Casos rodados: 2 de 12")
    expect(texto).toContain("Rodada interrompida: rate_limit")
  })

  it("traz a tabela de métricas, a de custo e a lista de falhas", () => {
    expect(texto).toContain("| Conteúdo: deve incluir | 1/2 (50%) |")
    expect(texto).toContain("| Latência por run (p50 / p95) | 1000 ms / 1000 ms |")
    expect(texto).toContain("| decisao | 6 | 2000 | 400 |")
    expect(texto).toContain("- c1-02: deve: Algo que refresca")
  })

  it("sem falhas diz Nenhuma e não marca interrupção", () => {
    const limpo = formatarRelatorio({
      ...rodada,
      interrompidaPor: undefined,
      casos: [caso({ id: "x" })],
    })
    expect(limpo).toContain("Nenhuma.")
    expect(limpo).not.toContain("interrompida")
  })
})

describe("casos do checkpoint c1-base", () => {
  it("são 12, com ids únicos", () => {
    expect(casosC1).toHaveLength(12)
    expect(new Set(casosC1.map((c) => c.id)).size).toBe(12)
  })

  it.each(casosC1.map((c) => [c.id, c] as const))("%s tem cenário válido", async (_id, c) => {
    expect(entradaDoAcompanhanteSchema.safeParse(c.cenario.entrada).success).toBe(true)
    expect(c.deve.length + c.naoPode.length).toBeGreaterThan(0)
    const { contaId } = await montarCenario({ ...c.cenario, roteiro: [] })
    expect(contaId).toBeTruthy()
  })
})
