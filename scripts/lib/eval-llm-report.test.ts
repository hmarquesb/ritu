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
      anotacoes: [],
      propostas: [],
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
    promptVersao: "acompanhante.v2",
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
    expect(texto).toContain("Versão do prompt: acompanhante.v2")
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

function interprete(parcial: Partial<ResultadoDoCaso> & { id: string }): ResultadoDoCaso {
  return caso({
    tipo: "interprete",
    explicacao: undefined,
    uso: { apoio: { chamadas: 1, tokens_entrada: 100, tokens_saida: 10 } },
    ...parcial,
  })
}

describe("Intérprete no relatório", () => {
  const casos = [
    caso({ id: "a" }),
    interprete({ id: "i1", latenciaMs: 100 }),
    interprete({
      id: "i2",
      latenciaMs: 300,
      deve: [{ descricao: "x", ok: false }],
      falsoAlerta: true,
      alertou: true,
      uso: { apoio: { chamadas: 1, tokens_entrada: 100, tokens_saida: 10 } },
    }),
  ]
  const r = resumir(casos)

  it("separa o Intérprete das respostas: as métricas de resposta não contam os seus casos", () => {
    expect(r.casos).toBe(1)
    expect(r.uso.decisao?.chamadas).toBe(3)
  })

  it("conta intenção, falsos alertas e custo do apoio com p50 e p95", () => {
    expect(r.interprete.casos).toBe(2)
    expect(r.interprete.intencao).toBe(1)
    expect(r.interprete.falsosAlertas).toBe(1)
    expect(r.interprete.marcadosFalsoAlerta).toBe(1)
    expect(r.interprete.chamadas).toBe(2)
    expect(r.interprete.tokensEntrada).toBe(200)
    expect(r.interprete.tokensSaida).toBe(20)
    expect(r.interprete.latenciaP50).toBe(100)
    expect(r.interprete.latenciaP95).toBe(300)
  })

  it("um erro do Intérprete não entra na latência", () => {
    const comErro = resumir([interprete({ id: "e", erro: "sem_modelo", latenciaMs: 0 })])
    expect(comErro.interprete.intencao).toBe(0)
    expect(comErro.interprete.latenciaP50).toBe(0)
  })

  it("mostra a seção Intenção com a tabela por caso, o total e os falsos alertas", () => {
    const texto = formatarRelatorio({
      checkpoint: "c2-conversa",
      promptVersao: "x",
      totalDeCasos: 3,
      casos,
    })
    expect(texto).toContain("## Intenção")
    expect(texto).toContain("| i1 | 1/1 | 1/1 | sim | 100 ms |")
    expect(texto).toContain("| i2 | 0/1 | 1/1 | não | 300 ms |")
    expect(texto).toContain("- Intenção: 1/2 (50%)")
    expect(texto).toContain("- Falsos alertas: 1 de 1 casos marcados")
    expect(texto).toContain("### Custo do papel apoio")
    expect(texto).toContain("| 2 | 200 | 20 | 100 ms | 300 ms |")
  })
})

describe("violações da primeira entrega", () => {
  it("soma por código, só nas respostas", () => {
    const r = resumir([
      caso({ id: "a", violacoesDaPrimeira: ["fora_da_base", "fora_da_base", "estrutura"] }),
      caso({ id: "b", violacoesDaPrimeira: ["fora_da_base"] }),
      interprete({ id: "i", violacoesDaPrimeira: ["linha_base"] }),
    ])
    expect(r.violacoes).toEqual({ fora_da_base: 3, estrutura: 1 })
  })

  it("aparece no relatório ao lado das métricas, com Nenhuma quando não há", () => {
    const rodada = { checkpoint: "c1-base", promptVersao: "acompanhante.v2", totalDeCasos: 1 }
    const com = formatarRelatorio({
      ...rodada,
      casos: [caso({ id: "a", violacoesDaPrimeira: ["fora_da_base"] })],
    })
    expect(com).toContain("## Violações da 1ª entrega")
    expect(com).toContain("| fora_da_base | 1 |")
    const sem = formatarRelatorio({ ...rodada, casos: [caso({ id: "a" })] })
    expect(sem).toContain("## Violações da 1ª entrega\n\nNenhuma.")
  })
})

describe("seção Perguntas", () => {
  const conversa = (id: string, parcial: Partial<ResultadoDoCaso>) =>
    caso({ id, tipo: "conversa", ...parcial })

  const casos = [
    conversa("p1", { pergunta: "necessaria", perguntas: ["casa"], recusadas: 0 }),
    conversa("p2", { pergunta: "necessaria", perguntas: [], recusadas: 1 }),
    conversa("p3", { pergunta: "desnecessaria", perguntas: [], recusadas: 0 }),
    conversa("p4", { pergunta: "desnecessaria", perguntas: ["come"], recusadas: 0 }),
  ]

  it("mostra acerto por caso e o total de cada medida", () => {
    const texto = formatarRelatorio({
      checkpoint: "c2-conversa",
      promptVersao: "acompanhante.v3",
      totalDeCasos: 4,
      casos,
    })
    expect(texto).toContain("## Perguntas")
    expect(texto).toContain("| p1 | necessária | casa | sim |")
    expect(texto).toContain("| p2 | necessária | nenhuma | não |")
    expect(texto).toContain("| p4 | desnecessária | come | não |")
    expect(texto).toContain("- Perguntas necessárias feitas: 1/2 (50%)")
    expect(texto).toContain("- Desnecessárias evitadas: 1/2 (50%)")
    expect(texto).toContain(
      "- Perguntas recusadas pelo código por run: 0.25 (1 no total, em 4 runs)",
    )
  })

  it("sem casos com pergunta, a seção não aparece", () => {
    const texto = formatarRelatorio({
      checkpoint: "c1-base",
      promptVersao: "acompanhante.v3",
      totalDeCasos: 1,
      casos: [caso({ id: "a" })],
    })
    expect(texto).not.toContain("## Perguntas")
  })

  it("conversa sem pergunta marcada não entra na seção", () => {
    const texto = formatarRelatorio({
      checkpoint: "c2-conversa",
      promptVersao: "acompanhante.v3",
      totalDeCasos: 1,
      casos: [conversa("x", {})],
    })
    expect(texto).not.toContain("## Perguntas")
  })
})

describe("seção Propostas", () => {
  const conversa = (id: string, parcial: Partial<ResultadoDoCaso>) =>
    caso({ id, tipo: "conversa", propostasRecusadas: 0, ...parcial })

  const casos = [
    conversa("pr1", { proposta: "esperada", propostas: 1, propostasRecusadas: 1 }),
    conversa("pr2", { proposta: "esperada", propostas: 0 }),
    conversa("pr3", { proposta: "nenhuma", propostas: 0 }),
    conversa("pr4", { proposta: "nenhuma", propostas: 2, propostasRecusadas: 1 }),
    conversa("pr5", {
      proposta: "esperada",
      propostas: 1,
      deve: [{ descricao: "a", ok: false }],
    }),
    conversa("pr6", { proposta: "esperada", erro: "pausou_acima_do_teto" }),
  ]

  it("mostra acerto por caso e o total, com a média de recusas por run", () => {
    const texto = formatarRelatorio({
      checkpoint: "c2-conversa",
      promptVersao: "acompanhante.v4",
      totalDeCasos: 6,
      casos,
    })
    expect(texto).toContain("## Propostas")
    expect(texto).toContain("| pr1 | esperada | 1 | sim |")
    expect(texto).toContain("| pr2 | esperada | 0 | não |")
    expect(texto).toContain("| pr3 | nenhuma | 0 | sim |")
    expect(texto).toContain("| pr4 | nenhuma | 2 | não |")
    expect(texto).toContain("| pr5 | esperada | 1 | não |")
    expect(texto).toContain("| pr6 | esperada | erro: pausou_acima_do_teto | não |")
    expect(texto).toContain("- Propostas corretas: 2/6 (33%)")
    expect(texto).toContain(
      "- Propostas recusadas pelo código por run: 0.33 (2 no total, em 6 runs)",
    )
  })

  it("esperada sem proposta, ou nenhuma com proposta, não acerta", () => {
    const texto = formatarRelatorio({
      checkpoint: "c2-conversa",
      promptVersao: "acompanhante.v4",
      totalDeCasos: 2,
      casos: [
        conversa("x1", { proposta: "esperada", propostas: 0 }),
        conversa("x2", { proposta: "nenhuma", propostas: 1 }),
      ],
    })
    expect(texto).toContain("- Propostas corretas: 0/2 (0%)")
  })

  it("sem casos com proposta, a seção não aparece, mesmo com recusas", () => {
    const texto = formatarRelatorio({
      checkpoint: "c2-conversa",
      promptVersao: "acompanhante.v4",
      totalDeCasos: 1,
      casos: [conversa("y", { propostasRecusadas: 1 })],
    })
    expect(texto).not.toContain("## Propostas")
  })
})

describe("seções sem caso do tipo não aparecem", () => {
  it("só com Intérprete, não há Métricas, Casos nem Violações", () => {
    const texto = formatarRelatorio({
      checkpoint: "c2-conversa",
      promptVersao: "interprete.v1",
      totalDeCasos: 1,
      casos: [interprete({ id: "i" })],
    })
    expect(texto).not.toContain("## Métricas")
    expect(texto).not.toContain("## Casos")
    expect(texto).not.toContain("## Violações")
    expect(texto).toContain("## Intenção")
  })

  it("só com acompanhante, não há Intenção nem custo do apoio", () => {
    const texto = formatarRelatorio({
      checkpoint: "c1-base",
      promptVersao: "acompanhante.v2",
      totalDeCasos: 1,
      casos: [caso({ id: "a" })],
    })
    expect(texto).not.toContain("## Intenção")
    expect(texto).not.toContain("Custo do papel apoio")
  })
})
