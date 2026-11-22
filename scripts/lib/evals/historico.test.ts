import { describe, expect, it } from "vitest"
import {
  anteriorA,
  entradaDaRodada,
  formatarHistorico,
  type Historico,
  historicoSchema,
  lerHistorico,
  trocarEntrada,
} from "./historico"
import type { Meta } from "./metas"
import type { ResultadoDoCaso } from "./resultado"

type Run = NonNullable<ResultadoDoCaso["run"]>

function caso(extra: Partial<ResultadoDoCaso> = {}): ResultadoDoCaso {
  return {
    id: "c1-01-frio-agitada",
    titulo: "Frio e agitada",
    tipo: "acompanhante",
    familias: ["intencao"],
    marcas: [],
    checagens: [],
    acertou: true,
    estado: (extra.acertou ?? true) ? "acertou" : "falhou",
    uso: {},
    trocas: 0,
    latenciaMs: 100,
    modelos: ["modelo-a"],
    ...extra,
  }
}

function run(extra: Partial<Run> = {}): Run {
  return {
    origem: "agente",
    trajetoriaOk: null,
    chamadasDesnecessarias: 0,
    passos: 1,
    validacoes: [],
    violacoesDa1a: [],
    perguntasFeitas: 0,
    perguntasRecusadas: 0,
    propostasRecusadas: 0,
    juizAprovado: null,
    ...extra,
  }
}

const PROMPTS = { acompanhante: "v6", interprete: "v1" }

function entrada(checkpoint: string, data = "2026-11-16") {
  return entradaDaRodada({ checkpoint, data, prompts: PROMPTS, resultados: [], metas: {} })
}

function historicoCom(...checkpoints: string[]): Historico {
  return { versao: 1, checkpoints: checkpoints.map((nome) => entrada(nome)) }
}

describe("entradaDaRodada", () => {
  it("soma as violações da primeira tentativa por código", () => {
    const resultados = [
      caso({ run: run({ violacoesDa1a: ["fora_da_base", "estrutura"] }) }),
      caso({ run: run({ violacoesDa1a: ["fora_da_base"] }) }),
      caso({ run: run({ violacoesDa1a: [] }) }),
    ]
    const e = entradaDaRodada({
      checkpoint: "c1-base",
      data: "2026-11-16",
      prompts: PROMPTS,
      resultados,
      metas: {},
    })
    expect(e.violacoes_da_1a).toEqual({ fora_da_base: 2, estrutura: 1 })
  })

  it("conta os casos com erro e lista os modelos sem repetir, em ordem", () => {
    const resultados = [
      caso({ modelos: ["modelo-b", "modelo-a"] }),
      caso({ modelos: ["modelo-a"], erro: "LlmError:rate_limit" }),
    ]
    const e = entradaDaRodada({
      checkpoint: "c1-base",
      data: "2026-11-16",
      prompts: PROMPTS,
      resultados,
      metas: {},
    })
    expect(e.casos).toBe(2)
    expect(e.casos_com_erro).toBe(1)
    expect(e.modelos).toEqual(["modelo-a", "modelo-b"])
    expect(e.prompts).toEqual(PROMPTS)
    expect(e.data).toBe("2026-11-16")
    expect(e.checkpoint).toBe("c1-base")
  })

  it("marca as métricas abaixo da meta e as críticas", () => {
    const resultados = [
      caso({ familias: ["intencao"], acertou: true }),
      caso({ familias: ["intencao"], acertou: false, checagens: [] }),
    ]
    const metas: Record<string, Meta> = {
      "intencao.acerto": { min: 0.9, critica: true },
    }
    const e = entradaDaRodada({
      checkpoint: "c1-base",
      data: "2026-11-16",
      prompts: PROMPTS,
      resultados,
      metas,
    })
    expect(e.abaixo_da_meta).toEqual(["intencao.acerto"])
    expect(e.criticas).toEqual(["intencao.acerto"])
    expect(e.metricas["intencao.acerto"]).toEqual({ valor: 0.5, parte: 1, total: 2 })
  })

  it("não guarda nenhuma string longa (sem texto de resposta)", () => {
    const resultados = [
      caso({
        titulo: "Um título de caso qualquer",
        run: run({ violacoesDa1a: ["fora_da_base"] }),
        modelos: ["modelo-a"],
      }),
    ]
    const e = entradaDaRodada({
      checkpoint: "c1-base",
      data: "2026-11-16",
      prompts: PROMPTS,
      resultados,
      metas: {},
    })
    const textos: string[] = []
    const colher = (valor: unknown): void => {
      if (typeof valor === "string") textos.push(valor)
      else if (Array.isArray(valor)) valor.forEach(colher)
      else if (valor !== null && typeof valor === "object") {
        for (const [chave, v] of Object.entries(valor)) {
          textos.push(chave)
          colher(v)
        }
      }
    }
    colher(e)
    expect(textos.length).toBeGreaterThan(0)
    for (const texto of textos) expect(texto.length).toBeLessThanOrEqual(64)
  })
})

describe("trocarEntrada", () => {
  it("troca a entrada do mesmo checkpoint e mantém a ordem de checkpoints.ts", () => {
    const h = historicoCom("c3-confiavel")
    const nova = { ...entrada("c1-base"), casos: 12 }
    const trocado = trocarEntrada(h, nova)
    expect(trocado.checkpoints.map((e) => e.checkpoint)).toEqual(["c1-base", "c3-confiavel"])
  })

  it("troca no lugar quando o mesmo checkpoint já existe", () => {
    const h = historicoCom("c1-base", "c2-conversa")
    const nova = { ...entrada("c1-base", "2026-11-20"), casos: 99 }
    const trocado = trocarEntrada(h, nova)
    expect(trocado.checkpoints).toHaveLength(2)
    expect(trocado.checkpoints[0]).toEqual(nova)
  })

  it("nome fora da lista de checkpoints vai ao fim", () => {
    const h = historicoCom("c1-base")
    const trocado = trocarEntrada(h, entrada("outro"))
    expect(trocado.checkpoints.map((e) => e.checkpoint)).toEqual(["c1-base", "outro"])
  })
})

describe("anteriorA", () => {
  it("devolve o checkpoint imediatamente à esquerda que exista no histórico", () => {
    const h = historicoCom("c1-base")
    expect(anteriorA(h, "c3-confiavel")?.checkpoint).toBe("c1-base")
  })

  it("devolve undefined quando nenhum à esquerda existe", () => {
    const h = historicoCom("c3-confiavel")
    expect(anteriorA(h, "c1-base")).toBeUndefined()
  })
})

describe("lerHistorico", () => {
  it("arquivo ausente vira histórico vazio", () => {
    expect(lerHistorico(undefined)).toEqual({ ok: true, historico: { versao: 1, checkpoints: [] } })
  })

  it("JSON inválido dá ok false", () => {
    expect(lerHistorico("{não é json")).toEqual({ ok: false })
  })

  it("schema inválido dá ok false", () => {
    expect(lerHistorico(JSON.stringify({ versao: 2, checkpoints: [] }))).toEqual({ ok: false })
  })

  it("ida e volta com formatarHistorico", () => {
    const h = historicoCom("c1-base", "c2-conversa")
    const lido = lerHistorico(formatarHistorico(h))
    expect(lido).toEqual({ ok: true, historico: h })
    expect(historicoSchema.safeParse(h).success).toBe(true)
  })
})

describe("formatarHistorico", () => {
  it("JSON com 2 espaços e quebra de linha no fim", () => {
    const texto = formatarHistorico({ versao: 1, checkpoints: [] })
    expect(texto).toBe('{\n  "versao": 1,\n  "checkpoints": []\n}\n')
  })
})
