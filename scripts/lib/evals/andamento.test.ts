import { describe, expect, it } from "vitest"
import { llmCotas } from "../../../config/llm-cotas"
import { type Andamento, arquivoDoAndamento, assinar, lerAndamento } from "./andamento"
import type { ResultadoDoCaso } from "./resultado"

const PROMPTS = {
  acompanhante: "v6",
  interprete: "v1",
  memoria: "v1",
  juiz: "v1",
  avaliador: "v1",
}

const IDS = ["c1-01-frio-agitada", "c1-02-calor-irritada"]

function assinatura(parcial: Partial<Parameters<typeof assinar>[0]> = {}): string {
  return assinar({ ids: IDS, prompts: PROMPTS, papeis: llmCotas.papeis, ...parcial })
}

const resultado: ResultadoDoCaso = {
  id: "c1-01-frio-agitada",
  titulo: "Frio e agitada",
  tipo: "acompanhante",
  familias: ["conteudo"],
  marcas: [],
  checagens: [{ lista: "deve", descricao: "cita um chá", ok: true }],
  acertou: true,
  estado: "acertou",
  uso: {},
  trocas: 0,
  latenciaMs: 10,
  modelos: [],
}

function andamentoCom(resultados: ResultadoDoCaso[]): Andamento {
  return {
    versao: 1,
    checkpoint: "c1-base",
    assinatura: "abc",
    iniciada_em: "2026-06-15T22:00:00.000Z",
    resultados,
  }
}

describe("assinar", () => {
  it("é um sha256 em hexadecimal", () => {
    expect(assinatura()).toMatch(/^[0-9a-f]{64}$/)
  })

  it("muda quando entra um id a mais", () => {
    expect(assinatura({ ids: [...IDS, "c1-03-pesada-depois-do-almoco"] })).not.toBe(assinatura())
  })

  it("muda quando a versão de um prompt muda", () => {
    expect(assinatura({ prompts: { ...PROMPTS, juiz: "v2" } })).not.toBe(assinatura())
  })

  it("muda quando a lista de modelos de um papel muda", () => {
    const papeis = {
      ...llmCotas.papeis,
      apoio: ["gemini-3.5-flash-lite"],
    } as unknown as typeof llmCotas.papeis
    expect(assinatura({ papeis })).not.toBe(assinatura())
  })

  it("é igual com as chaves de prompts em outra ordem", () => {
    const invertidos = Object.fromEntries(Object.entries(PROMPTS).reverse())
    expect(assinatura({ prompts: invertidos })).toBe(assinatura())
  })
})

describe("lerAndamento", () => {
  it("lê o que foi gravado", () => {
    const andamento = andamentoCom([resultado])
    const lido = lerAndamento(JSON.stringify(andamento))
    expect(lido).toEqual({ ok: true, andamento })
  })

  it("recusa JSON inválido", () => {
    expect(lerAndamento("{ isto não é json")).toEqual({ ok: false })
  })

  it("recusa a versão 2", () => {
    const outra = { ...andamentoCom([]), versao: 2 }
    expect(lerAndamento(JSON.stringify(outra))).toEqual({ ok: false })
  })

  it("recusa um resultado sem a forma de caso", () => {
    const quebrado = { ...andamentoCom([]), resultados: [{ id: "c1-01" }] }
    expect(lerAndamento(JSON.stringify(quebrado))).toEqual({ ok: false })
  })
})

describe("arquivoDoAndamento", () => {
  it("fica em evals/local, com o nome do checkpoint", () => {
    expect(arquivoDoAndamento("c1-base")).toBe("evals/local/andamento-c1-base.json")
  })
})

describe("lerAndamento com estado", () => {
  it("andamento antigo sem estado: acertou vira acertou e o resto vira falhou", () => {
    const antigo = (r: Partial<ResultadoDoCaso>) => {
      const { estado: _, ...semEstado } = { ...resultado, ...r }
      return semEstado
    }
    const texto = JSON.stringify({
      versao: 1,
      checkpoint: "c1-base",
      assinatura: "a",
      iniciada_em: "2026-06-01T10:00:00.000Z",
      resultados: [
        antigo({ acertou: true }),
        antigo({ id: "c1-02-calor-irritada", acertou: false }),
      ],
    })
    const lido = lerAndamento(texto)
    expect(lido.ok && lido.andamento.resultados.map((r) => r.estado)).toEqual(["acertou", "falhou"])
  })
})
