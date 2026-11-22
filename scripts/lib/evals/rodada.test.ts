import { describe, expect, it } from "vitest"
import type { CasoDeEval } from "../../../evals/llm/casos"
import { casosC1 } from "../../../evals/llm/casos/c1"
import { SemModeloError } from "../../../src/core/llm/chamar"
import { LlmError } from "../../../src/core/llm/errors"
import { createFixedClock } from "../../../src/infra/fakes/fixed-clock"
import type { Andamento } from "./andamento"
import type { ResultadoDoCaso } from "./resultado"
import { ehParada, executarRodada } from "./rodada"

const AGORA = "2026-06-15T22:00:00.000Z"
const CASOS = casosC1.slice(0, 4) as CasoDeEval[]
const [PRIMEIRO, SEGUNDO, TERCEIRO, QUARTO] = CASOS as [
  CasoDeEval,
  CasoDeEval,
  CasoDeEval,
  CasoDeEval,
]

function ok(caso: CasoDeEval, extra: Partial<ResultadoDoCaso> = {}): ResultadoDoCaso {
  return {
    id: caso.id,
    titulo: caso.titulo,
    tipo: caso.tipo,
    familias: caso.familias,
    marcas: [],
    checagens: [{ lista: "deve", descricao: "cita um chá", ok: true }],
    acertou: true,
    estado: "acertou",
    uso: {},
    trocas: 0,
    latenciaMs: 10,
    modelos: [],
    ...extra,
  }
}

function errado(caso: CasoDeEval): ResultadoDoCaso {
  return { ...ok(caso), checagens: [{ lista: "deve", descricao: "x", ok: false }], acertou: false }
}

function base(overrides: Partial<Parameters<typeof executarRodada>[0]> = {}) {
  const clock = createFixedClock(AGORA)
  const salvos: Andamento[] = []
  const esperas: number[] = []
  const linhas: string[] = []
  return {
    clock,
    salvos,
    esperas,
    linhas,
    params: {
      checkpoint: "c1-base",
      casos: CASOS,
      assinatura: "assinatura-1",
      clock,
      rodarCaso: async (caso: CasoDeEval) => ok(caso),
      salvar: async (a: Andamento) => {
        salvos.push(structuredClone(a))
      },
      esperar: async (ms: number) => {
        esperas.push(ms)
      },
      log: (linha: string) => {
        linhas.push(linha)
      },
      ...overrides,
    },
  }
}

describe("ehParada", () => {
  it("vale para o modelo sem cota e para o limite de taxa", () => {
    expect(ehParada(new SemModeloError())).toBe(true)
    expect(ehParada(new LlmError("rate_limit", "x"))).toBe(true)
  })

  it("não vale para timeout, indisponível ou erro comum", () => {
    expect(ehParada(new LlmError("timeout", "x"))).toBe(false)
    expect(ehParada(new LlmError("indisponivel", "x"))).toBe(false)
    expect(ehParada(new Error("x"))).toBe(false)
  })
})

describe("executarRodada", () => {
  it("completa e grava o andamento depois de cada caso", async () => {
    const t = base()
    const fim = await executarRodada(t.params)

    expect(fim.fim).toBe("completa")
    expect(t.salvos.map((a) => a.resultados.length)).toEqual([1, 2, 3, 4])
    expect(fim.andamento.resultados.map((r) => r.id)).toEqual(CASOS.map((c) => c.id))
    expect(fim.andamento).toMatchObject({
      versao: 1,
      checkpoint: "c1-base",
      assinatura: "assinatura-1",
      iniciada_em: AGORA,
    })
  })

  it("registra uma linha por caso", async () => {
    const t = base({
      rodarCaso: async (caso) => {
        if (caso.id === PRIMEIRO.id) return errado(caso)
        if (caso.id === SEGUNDO.id) throw new Error("boom")
        return ok(caso)
      },
    })
    await executarRodada(t.params)

    expect(t.linhas).toEqual([
      `${PRIMEIRO.id}  errado`,
      `${SEGUNDO.id}  erro (Error)`,
      `${TERCEIRO.id}  ok`,
      `${QUARTO.id}  ok`,
    ])
  })

  it.each([
    ["SemModeloError", () => new SemModeloError()],
    ["LlmError rate_limit", () => new LlmError("rate_limit", "x")],
  ])("para na cota (%s) sem gravar o caso em que parou", async (_nome, erro) => {
    const t = base({
      rodarCaso: async (caso) => {
        if (caso.id === SEGUNDO.id) throw erro()
        return ok(caso)
      },
    })
    const fim = await executarRodada(t.params)

    expect(fim).toMatchObject({ fim: "interrompida", motivo: "cota", parouEm: SEGUNDO.id })
    expect(fim.andamento.resultados.map((r) => r.id)).toEqual([PRIMEIRO.id])
    expect(t.salvos.map((a) => a.resultados.length)).toEqual([1])
  })

  it("três erros seguidos interrompem e ficam gravados com o código", async () => {
    const t = base({
      rodarCaso: async () => {
        throw new LlmError("timeout", "x")
      },
    })
    const fim = await executarRodada(t.params)

    expect(fim).toMatchObject({
      fim: "interrompida",
      motivo: "erros_seguidos",
      parouEm: TERCEIRO.id,
    })
    expect(fim.andamento.resultados).toHaveLength(3)
    expect(fim.andamento.resultados.every((r) => r.erro === "LlmError:timeout")).toBe(true)
    expect(fim.andamento.resultados.every((r) => r.acertou === false)).toBe(true)
  })

  it("erro, ok, erro, erro não interrompe", async () => {
    const t = base({
      rodarCaso: async (caso) => {
        const indice = CASOS.findIndex((c) => c.id === caso.id)
        if (indice === 1) return ok(caso)
        throw new Error("falha")
      },
    })
    const fim = await executarRodada(t.params)

    expect(fim.fim).toBe("completa")
    expect(fim.andamento.resultados.map((r) => r.erro)).toEqual([
      "Error",
      undefined,
      "Error",
      "Error",
    ])
  })

  it("a retomada pula os feitos e refaz os que têm erro, mantendo iniciada_em", async () => {
    const chamados: string[] = []
    const anterior: Andamento = {
      versao: 1,
      checkpoint: "c1-base",
      assinatura: "assinatura-1",
      iniciada_em: "2026-06-01T10:00:00.000Z",
      resultados: [ok(PRIMEIRO), { ...ok(SEGUNDO), erro: "Error", acertou: false }],
    }
    const t = base({
      anterior,
      rodarCaso: async (caso) => {
        chamados.push(caso.id)
        return ok(caso)
      },
    })
    const fim = await executarRodada(t.params)

    expect(chamados).toEqual([SEGUNDO.id, TERCEIRO.id, QUARTO.id])
    expect(fim.andamento.iniciada_em).toBe("2026-06-01T10:00:00.000Z")
    expect(fim.andamento.resultados.map((r) => [r.id, r.erro])).toEqual(
      CASOS.map((c) => [c.id, undefined]),
    )
  })

  it("pausa depois de cada caso que rodou, sem pausa depois do último", async () => {
    const t = base({
      rodarCaso: async (caso) => {
        t.clock.advance(1000)
        return ok(caso, { uso: { decisao: { chamadas: 3, tokens_entrada: 0, tokens_saida: 0 } } })
      },
    })
    await executarRodada({ ...t.params, casos: CASOS.slice(0, 2) })

    expect(t.esperas).toEqual([12_500])
  })

  it("pausa mínima quando o caso tem uma chamada e demorou um segundo", async () => {
    const t = base({
      rodarCaso: async (caso) => {
        t.clock.advance(1000)
        return ok(caso, { uso: { decisao: { chamadas: 1, tokens_entrada: 0, tokens_saida: 0 } } })
      },
    })
    await executarRodada({ ...t.params, casos: CASOS.slice(0, 2) })

    expect(t.esperas).toEqual([4000])
  })

  it("conta as chamadas do avaliador na pausa", async () => {
    const t = base({
      rodarCaso: async (caso) => {
        t.clock.advance(1000)
        return ok(caso, {
          uso: { decisao: { chamadas: 1, tokens_entrada: 0, tokens_saida: 0 } },
          usoDoAvaliador: { chamadas: 2, tokens_entrada: 0, tokens_saida: 0 },
        })
      },
    })
    await executarRodada({ ...t.params, casos: CASOS.slice(0, 2) })

    expect(t.esperas).toEqual([12_500])
  })

  it("na retomada não pausa pelos casos pulados", async () => {
    const anterior: Andamento = {
      versao: 1,
      checkpoint: "c1-base",
      assinatura: "assinatura-1",
      iniciada_em: AGORA,
      resultados: [ok(PRIMEIRO)],
    }
    const t = base({ anterior })
    await executarRodada({ ...t.params, casos: CASOS.slice(0, 3) })

    expect(t.esperas).toEqual([4000])
  })
})

describe("resultado de erro classificado", () => {
  it("erro de banco vira inconclusivo por banco, sem acertou", async () => {
    const t = base({
      casos: [PRIMEIRO],
      rodarCaso: async () => {
        throw new AggregateError([], "x")
      },
    })
    const fim = await executarRodada(t.params)

    expect(fim.andamento.resultados[0]).toMatchObject({
      erro: "AggregateError",
      acertou: false,
      estado: "inconclusivo",
      inconclusivo: "banco",
    })
  })

  it("timeout sem decisão vira inconclusivo por timeout_sem_decisao", async () => {
    const t = base({
      casos: [PRIMEIRO],
      rodarCaso: async () => {
        throw new LlmError("timeout", "x")
      },
    })
    const fim = await executarRodada(t.params)

    expect(fim.andamento.resultados[0]).toMatchObject({
      estado: "inconclusivo",
      inconclusivo: "timeout_sem_decisao",
    })
  })

  it("outro erro sem etapas vira inconclusivo por sem_etapas", async () => {
    const t = base({
      casos: [PRIMEIRO],
      rodarCaso: async () => {
        throw new TypeError("x")
      },
    })
    const fim = await executarRodada(t.params)

    expect(fim.andamento.resultados[0]).toMatchObject({
      erro: "TypeError",
      estado: "inconclusivo",
      inconclusivo: "sem_etapas",
    })
  })
})

describe("retomada refaz inconclusivos", () => {
  it("refaz o inconclusivo e os que faltam; os conclusivos ficam", async () => {
    const chamados: string[] = []
    const anterior: Andamento = {
      versao: 1,
      checkpoint: "c1-base",
      assinatura: "assinatura-1",
      iniciada_em: "2026-06-01T10:00:00.000Z",
      resultados: [
        ok(PRIMEIRO),
        { ...ok(SEGUNDO), acertou: false, estado: "inconclusivo", inconclusivo: "cota" },
        errado(TERCEIRO),
      ],
    }
    const t = base({
      anterior,
      rodarCaso: async (caso) => {
        chamados.push(caso.id)
        return ok(caso)
      },
    })
    const fim = await executarRodada(t.params)

    expect(chamados).toEqual([SEGUNDO.id, QUARTO.id])
    expect(fim.andamento.resultados.find((r) => r.id === TERCEIRO.id)?.acertou).toBe(false)
    expect(fim.andamento.resultados.find((r) => r.id === SEGUNDO.id)?.estado).toBe("acertou")
  })
})
