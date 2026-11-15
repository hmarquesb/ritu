import { describe, expect, it } from "vitest"
import { SemModeloError } from "../../src/core/llm/chamar"
import { LlmError } from "../../src/core/llm/errors"
import { formatarRelatorio, type ResultadoDoCaso, resumir } from "./eval-llm-report"
import { executarRodada, resolverExplicacao } from "./eval-llm-rodada"

const caso = (id: string) => ({
  id,
  titulo: `Caso ${id}`,
  deve: [{ descricao: "d" }],
  naoPode: [{ descricao: "n" }],
})

const bom = (id: string, extra: Partial<ResultadoDoCaso> = {}): ResultadoDoCaso => ({
  id,
  titulo: `Caso ${id}`,
  deve: [{ descricao: "d", ok: true }],
  naoPode: [{ descricao: "n", ok: true }],
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
  uso: {},
  trocas: 0,
  latenciaMs: 100,
  modelos: [],
  ...extra,
})

const base = { checkpoint: "c1-base", promptVersao: "v1", pausaMs: 0, log: () => {} }

describe("resolverExplicacao", () => {
  it("timeout do apoio vira não avaliada", async () => {
    const r = await resolverExplicacao(async () => {
      throw new LlmError("timeout", "x")
    })
    expect(r).toEqual({ naoAvaliada: true })
  })

  it("repassa parada da rodada", async () => {
    await expect(
      resolverExplicacao(async () => {
        throw new SemModeloError()
      }),
    ).rejects.toBeInstanceOf(SemModeloError)
  })
})

describe("executarRodada", () => {
  it("erro inesperado vira caso erro com só a classe, e a rodada segue", async () => {
    const rodada = await executarRodada({
      ...base,
      casos: [caso("a"), caso("b")],
      rodarCaso: async (c) => {
        if (c.id === "a") throw new TypeError("texto da pessoa vazou")
        return bom("b")
      },
    })
    expect(rodada.casos).toHaveLength(2)
    expect(rodada.casos[0]?.erro).toBe("TypeError")
    expect(rodada.casos[0]?.trajetoriaOk).toBe(false)
    const md = formatarRelatorio(rodada)
    expect(md).not.toContain("vazou")
    expect(md).toContain("erro: TypeError")
    expect(resumir(rodada.casos).conteudoDeve).toBe(1)
    expect(rodada.interrompidaPor).toBeUndefined()
  })

  it("SemModeloError para a rodada e guarda o que tem", async () => {
    const rodada = await executarRodada({
      ...base,
      casos: [caso("a"), caso("b"), caso("c")],
      rodarCaso: async (c) => {
        if (c.id === "b") throw new SemModeloError()
        return bom(c.id)
      },
    })
    expect(rodada.casos.map((c) => c.id)).toEqual(["a"])
    expect(rodada.interrompidaPor).toContain("b")
    expect(formatarRelatorio(rodada)).toContain("Rodada interrompida")
  })

  it("explicação não avaliada entra no relatório com a contagem de fora", async () => {
    const rodada = await executarRodada({
      ...base,
      casos: [caso("a"), caso("b")],
      rodarCaso: async (c) =>
        c.id === "a" ? bom("a", { explicacao: undefined, explicacaoNaoAvaliada: true }) : bom("b"),
    })
    const r = resumir(rodada.casos)
    expect(r.casos).toBe(2)
    expect(r.comExplicacao).toBe(1)
    expect(r.explicacaoNaoAvaliada).toBe(1)
    const md = formatarRelatorio(rodada)
    expect(md).toContain("1 não avaliada")
    expect(md).toContain("não avaliada")
  })
})
