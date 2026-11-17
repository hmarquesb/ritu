import { describe, expect, it } from "vitest"
import { llmCotas } from "../../../config/llm-cotas"
import { type CasoDeEval, casosDoCheckpoint } from "../../../evals/llm/casos"
import { SemModeloError } from "../../../src/core/llm/chamar"
import { LlmError } from "../../../src/core/llm/errors"
import { createFixedClock } from "../../../src/infra/fakes/fixed-clock"
import { type Andamento, arquivoDoAndamento, assinar } from "./andamento"
import { executarComando, type IoDoComando } from "./comando"
import type { Colhido, ResultadoDoCaso } from "./resultado"
import type { CasoRodado } from "./rodar-run"

// Quarta-feira no fuso do dia da cota: o dia de hoje é 2026-11-16.
const AGORA = "2026-11-16T15:00:00.000Z"
const HOJE = "2026-11-16"
const ONTEM = "2026-11-15"
const PROMPTS = {
  acompanhante: "acompanhante.v6",
  interprete: "interprete.v1",
  memoria: "memoria.v1",
  juiz: "juiz.v1",
  avaliador: "avaliador.v1",
}
const CANARIO = "zibelina"
const HISTORICO = "evals/resultados/historico.json"
const RELATORIO = "evals/resultados/c1-base.md"
const JSON_DO_CHECKPOINT = "evals/resultados/c1-base.json"
const COMPARACAO = "evals/COMPARACAO.md"
const FALHAS = "evals/local/c1-base-falhas.md"
const ANDAMENTO = arquivoDoAndamento("c1-base")

const CASOS_C1 = casosDoCheckpoint("c1-base")
const IDS_C1 = CASOS_C1.map((c) => c.id)

function caso(id: string): CasoDeEval {
  const achado = CASOS_C1.find((c) => c.id === id)
  if (achado === undefined) throw new Error(`caso ${id} não existe no teste`)
  return achado
}

function rodado(c: CasoDeEval, acertou = true, texto = "resposta do agente"): CasoRodado {
  const resultado: ResultadoDoCaso = {
    id: c.id,
    titulo: c.titulo,
    tipo: c.tipo ?? "acompanhante",
    familias: c.familias,
    marcas: c.marcas ?? [],
    checagens: [{ lista: "deve", descricao: "fala de chá", ok: acertou }],
    acertou,
    uso: {},
    trocas: 0,
    latenciaMs: 10,
    modelos: ["modelo-x"],
  }
  const colhido: Colhido = { texto, etapas: [] }
  return { resultado, colhido }
}

function andamentoCom(ids: string[], assinatura = assinatura0()): Andamento {
  return {
    versao: 1,
    checkpoint: "c1-base",
    assinatura,
    iniciada_em: AGORA,
    resultados: ids.map((id) => rodado(caso(id)).resultado),
  }
}

function assinatura0(): string {
  return assinar({ ids: IDS_C1, prompts: PROMPTS, papeis: llmCotas.papeis })
}

function historicoDeOntem(): string {
  return JSON.stringify({
    versao: 1,
    checkpoints: [
      {
        checkpoint: "c1-base",
        data: ONTEM,
        prompts: PROMPTS,
        modelos: ["modelo-x"],
        casos: 12,
        casos_com_erro: 0,
        metricas: {},
        violacoes_da_1a: {},
        abaixo_da_meta: [],
        criticas: [],
      },
    ],
  })
}

type Preparo = {
  arquivos?: Record<string, string>
  rodarCaso?: (c: CasoDeEval) => Promise<CasoRodado>
  falhaAoGravar?: string
}

function criarIo(p: Preparo = {}) {
  const arquivos = new Map<string, string>(Object.entries(p.arquivos ?? {}))
  const logs: string[] = []
  const erros: string[] = []
  const chamados: string[] = []
  const clock = createFixedClock(AGORA)
  const io: IoDoComando & {
    arquivos: Map<string, string>
    logs: string[]
    erros: string[]
    chamados: string[]
  } = {
    arquivos,
    logs,
    erros,
    chamados,
    ler: async (caminho) => arquivos.get(caminho),
    gravar: async (caminho, texto) => {
      if (caminho === p.falhaAoGravar) throw new Error("disco cheio")
      arquivos.set(caminho, texto)
    },
    anexar: async (caminho, texto) => {
      arquivos.set(caminho, (arquivos.get(caminho) ?? "") + texto)
    },
    apagar: async (caminho) => {
      arquivos.delete(caminho)
    },
    log: (linha) => {
      logs.push(linha)
    },
    erro: (linha) => {
      erros.push(linha)
    },
    clock,
    esperar: async () => {},
    prompts: PROMPTS,
    papeis: llmCotas.papeis,
    rodarCaso: async (c) => {
      chamados.push(c.id)
      return p.rodarCaso ? p.rodarCaso(c) : rodado(c)
    },
  }
  return io
}

describe("executarComando: recusas e erros de argumento (código 1)", () => {
  it("sem --checkpoint recusa e lista os nomes", async () => {
    const io = criarIo()
    expect(await executarComando([], io)).toBe(1)
    expect(io.erros[0]).toContain(
      "Informe --checkpoint com um de: c1-base, c2-conversa, c3-confiavel",
    )
  })

  it("checkpoint desconhecido recusa e lista os nomes", async () => {
    const io = criarIo()
    expect(await executarComando(["--checkpoint", "c9"], io)).toBe(1)
    expect(io.erros[0]).toContain("c1-base, c2-conversa, c3-confiavel")
  })

  it("--retomar com --do-zero recusa", async () => {
    const io = criarIo()
    expect(await executarComando(["--checkpoint", "c1-base", "--retomar", "--do-zero"], io)).toBe(1)
    expect(io.erros[0]).toBe("--retomar e --do-zero não combinam.")
    expect(io.chamados).toEqual([])
  })

  it("--caso com id que não existe recusa e lista os ids", async () => {
    const io = criarIo()
    expect(await executarComando(["--checkpoint", "c1-base", "--caso", "nao-existe"], io)).toBe(1)
    expect(io.erros[0]).toContain("Caso nao-existe não existe em c1-base. Ids:")
    expect(io.erros[0]).toContain(IDS_C1[0] as string)
    expect(io.chamados).toEqual([])
  })

  it.each([
    ["--retomar", ["--retomar"]],
    ["--do-zero", ["--do-zero"]],
    ["--extra", ["--extra"]],
    ["--listar", ["--listar"]],
  ])("--caso com %s recusa", async (_, extra) => {
    const io = criarIo()
    const id = IDS_C1[0] as string
    expect(await executarComando(["--checkpoint", "c1-base", "--caso", id, ...extra], io)).toBe(1)
    expect(io.erros[0]).toContain("--caso roda um caso sem gravar nada")
    expect(io.chamados).toEqual([])
  })

  it("opção desconhecida recusa com a lista do que é aceito", async () => {
    const io = criarIo()
    expect(await executarComando(["--checkpoint", "c1-base", "--casos", "x"], io)).toBe(1)
    expect(io.erros[0]).toContain("Opções: --checkpoint <nome>")
  })

  it("--extra com --retomar recusa", async () => {
    const io = criarIo()
    expect(await executarComando(["--checkpoint", "c1-base", "--retomar", "--extra"], io)).toBe(1)
    expect(io.erros[0]).toContain("--extra só vale para rodada nova ou --do-zero")
  })
})

describe("executarComando: andamento e cota do dia", () => {
  it("rodada nova com andamento salvo recusa e indica --retomar e --do-zero", async () => {
    const io = criarIo({ arquivos: { [ANDAMENTO]: "{}" } })
    expect(await executarComando(["--checkpoint", "c1-base"], io)).toBe(1)
    expect(io.erros[0]).toContain("--retomar")
    expect(io.erros[0]).toContain("--do-zero")
    expect(io.chamados).toEqual([])
  })

  it("--retomar sem andamento recusa", async () => {
    const io = criarIo()
    expect(await executarComando(["--checkpoint", "c1-base", "--retomar"], io)).toBe(1)
    expect(io.erros[0]).toContain("Sem andamento de c1-base para retomar")
  })

  it("--retomar com andamento de outra assinatura recusa e indica --do-zero", async () => {
    const io = criarIo({
      arquivos: { [ANDAMENTO]: JSON.stringify(andamentoCom(IDS_C1.slice(0, 2), "outra")) },
    })
    expect(await executarComando(["--checkpoint", "c1-base", "--retomar"], io)).toBe(1)
    expect(io.erros[0]).toContain("--do-zero")
    expect(io.chamados).toEqual([])
  })

  it("--retomar com andamento de JSON inválido recusa e indica --do-zero", async () => {
    const io = criarIo({ arquivos: { [ANDAMENTO]: "{ não é json" } })
    expect(await executarComando(["--checkpoint", "c1-base", "--retomar"], io)).toBe(1)
    expect(io.erros[0]).toContain("--do-zero")
  })

  it("segunda rodada no mesmo dia é recusada sem --extra", async () => {
    const io = criarIo({ arquivos: { [HISTORICO]: historicoDeOntem() } })
    expect(await executarComando(["--checkpoint", "c1-base"], io)).toBe(0)
    const outra = criarIo({
      arquivos: { [HISTORICO]: historicoComHoje() },
    })
    expect(await executarComando(["--checkpoint", "c1-base"], outra)).toBe(1)
    expect(outra.erros[0]).toContain("Use --extra para rodar outra")
    expect(outra.chamados).toEqual([])
  })

  it("--extra permite outra rodada completa no mesmo dia", async () => {
    const io = criarIo({ arquivos: { [HISTORICO]: historicoComHoje() } })
    expect(await executarComando(["--checkpoint", "c1-base", "--extra"], io)).toBe(0)
    expect(io.chamados).toHaveLength(12)
  })

  it("--do-zero apaga o andamento e começa", async () => {
    const io = criarIo({
      arquivos: { [ANDAMENTO]: JSON.stringify(andamentoCom(IDS_C1.slice(0, 2))) },
    })
    expect(await executarComando(["--checkpoint", "c1-base", "--do-zero"], io)).toBe(0)
    expect(io.chamados).toHaveLength(12)
    expect(io.arquivos.has(ANDAMENTO)).toBe(false)
  })

  it("histórico inválido recusa e não é sobrescrito", async () => {
    const io = criarIo({ arquivos: { [HISTORICO]: "não é json" } })
    expect(await executarComando(["--checkpoint", "c1-base"], io)).toBe(1)
    expect(io.arquivos.get(HISTORICO)).toBe("não é json")
    expect(io.arquivos.has(RELATORIO)).toBe(false)
  })
})

describe("executarComando: recusa do dia por checkpoint", () => {
  it("rodada de c2 hoje não recusa a rodada nova de c3", async () => {
    const io = criarIo({ arquivos: { [HISTORICO]: historicoDoDia("c2-conversa", HOJE) } })
    expect(await executarComando(["--checkpoint", "c3-confiavel"], io)).toBe(0)
    expect(io.chamados).toHaveLength(84)
  })

  it("rodada de c3 hoje recusa a rodada nova de c3 com a mensagem do checkpoint", async () => {
    const io = criarIo({ arquivos: { [HISTORICO]: historicoDoDia("c3-confiavel", HOJE) } })
    expect(await executarComando(["--checkpoint", "c3-confiavel"], io)).toBe(1)
    expect(io.erros[0]).toBe(
      `Já há uma rodada completa de c3-confiavel hoje (${HOJE}). Use --extra para rodar outra.`,
    )
    expect(io.chamados).toEqual([])
  })

  it("rodada de c3 hoje não recusa com --extra", async () => {
    const io = criarIo({ arquivos: { [HISTORICO]: historicoDoDia("c3-confiavel", HOJE) } })
    expect(await executarComando(["--checkpoint", "c3-confiavel", "--extra"], io)).toBe(0)
    expect(io.chamados).toHaveLength(84)
  })

  it("--do-zero segue a mesma regra: c2 hoje não recusa c3", async () => {
    const io = criarIo({ arquivos: { [HISTORICO]: historicoDoDia("c2-conversa", HOJE) } })
    expect(await executarComando(["--checkpoint", "c3-confiavel", "--do-zero"], io)).toBe(0)
    expect(io.chamados).toHaveLength(84)
  })

  it("--do-zero recusa quando o mesmo checkpoint já rodou hoje", async () => {
    const io = criarIo({ arquivos: { [HISTORICO]: historicoDoDia("c3-confiavel", HOJE) } })
    expect(await executarComando(["--checkpoint", "c3-confiavel", "--do-zero"], io)).toBe(1)
    expect(io.erros[0]).toContain("Já há uma rodada completa de c3-confiavel hoje")
    expect(io.chamados).toEqual([])
  })
})

describe("executarComando: rodada completa", () => {
  it("grava relatório, JSON, histórico e comparação, e apaga o andamento", async () => {
    const io = criarIo()
    expect(await executarComando(["--checkpoint", "c1-base"], io)).toBe(0)
    expect(io.chamados).toHaveLength(12)
    expect(io.arquivos.has(RELATORIO)).toBe(true)
    expect(io.arquivos.has(JSON_DO_CHECKPOINT)).toBe(true)
    expect(io.arquivos.has(HISTORICO)).toBe(true)
    expect(io.arquivos.has(COMPARACAO)).toBe(true)
    expect(io.arquivos.has(ANDAMENTO)).toBe(false)
    const historico = JSON.parse(io.arquivos.get(HISTORICO) ?? "{}")
    expect(historico.checkpoints[0].data).toBe(HOJE)
  })

  it("caso errado não recusa a rodada e anexa a falha em evals/local", async () => {
    const io = criarIo({
      rodarCaso: async (c) => rodado(c, c.id !== IDS_C1[1], `texto do ${c.id} ${CANARIO}`),
    })
    expect(await executarComando(["--checkpoint", "c1-base"], io)).toBe(0)
    const falhas = io.arquivos.get(FALHAS) ?? ""
    expect(falhas).toContain("Falhas do c1-base")
    expect(falhas).toContain(`## ${IDS_C1[1]}`)
    expect(falhas).toContain(CANARIO)
  })

  it("nenhum arquivo de evals/resultados/ leva o texto colhido", async () => {
    const io = criarIo({
      rodarCaso: async (c) => rodado(c, c.id !== IDS_C1[0], `texto ${CANARIO}`),
    })
    expect(await executarComando(["--checkpoint", "c1-base"], io)).toBe(0)
    for (const [caminho, texto] of io.arquivos) {
      if (caminho.startsWith("evals/resultados/")) expect(texto).not.toContain(CANARIO)
    }
  })

  it("falha ao gravar o relatório mantém o andamento e sai com 1", async () => {
    const io = criarIo({ falhaAoGravar: RELATORIO })
    expect(await executarComando(["--checkpoint", "c1-base"], io)).toBe(1)
    expect(io.arquivos.has(ANDAMENTO)).toBe(true)
    expect(io.arquivos.has(HISTORICO)).toBe(false)
  })
})

describe("executarComando: interrompida", () => {
  it("SemModeloError sai com 2, imprime a linha exata e não grava relatório", async () => {
    let n = 0
    const io = criarIo({
      rodarCaso: async (c) => {
        n += 1
        if (n === 3) throw new SemModeloError()
        return rodado(c)
      },
    })
    expect(await executarComando(["--checkpoint", "c1-base"], io)).toBe(2)
    expect(io.erros[0]).toBe(
      `Rodada interrompida no caso ${IDS_C1[2]} (cota). 2 de 12 feitos. Continue com: npm run eval:llm -- --checkpoint c1-base --retomar`,
    )
    expect(io.arquivos.has(RELATORIO)).toBe(false)
    expect(io.arquivos.has(ANDAMENTO)).toBe(true)
  })

  it("rate_limit também interrompe com 2", async () => {
    const io = criarIo({
      rodarCaso: async () => {
        throw new LlmError("rate_limit", "limite")
      },
    })
    expect(await executarComando(["--checkpoint", "c1-base"], io)).toBe(2)
    expect(io.erros[0]).toContain("(cota). 0 de 12 feitos")
  })

  it("--retomar roda só os casos que faltam", async () => {
    const io = criarIo({
      arquivos: { [ANDAMENTO]: JSON.stringify(andamentoCom(IDS_C1.slice(0, 4))) },
    })
    expect(await executarComando(["--checkpoint", "c1-base", "--retomar"], io)).toBe(0)
    expect(io.chamados).toEqual(IDS_C1.slice(4))
  })

  it("--retomar com todos os casos feitos não roda caso e só refaz a escrita", async () => {
    const io = criarIo({
      arquivos: { [ANDAMENTO]: JSON.stringify(andamentoCom(IDS_C1)) },
    })
    expect(await executarComando(["--checkpoint", "c1-base", "--retomar"], io)).toBe(0)
    expect(io.chamados).toEqual([])
    expect(io.arquivos.has(RELATORIO)).toBe(true)
    expect(io.arquivos.has(ANDAMENTO)).toBe(false)
  })
})

describe("executarComando: --caso e --listar", () => {
  it("--caso roda o caso, imprime e não grava nada", async () => {
    const io = criarIo()
    expect(
      await executarComando(["--checkpoint", "c1-base", "--caso", IDS_C1[0] as string], io),
    ).toBe(0)
    expect(io.chamados).toEqual([IDS_C1[0]])
    expect(io.arquivos.size).toBe(0)
    expect(io.logs.some((l) => l.includes("Checagens:"))).toBe(true)
    expect(io.logs.some((l) => l.includes("ok"))).toBe(true)
  })

  it("--caso sem modelo sai com 2 e imprime sem modelo", async () => {
    const io = criarIo({
      rodarCaso: async () => {
        throw new SemModeloError()
      },
    })
    expect(
      await executarComando(["--checkpoint", "c1-base", "--caso", IDS_C1[0] as string], io),
    ).toBe(2)
    expect(io.erros).toEqual(["sem modelo"])
    expect(io.arquivos.size).toBe(0)
  })

  it("--listar sai com 0 sem chamar o rodador e mostra a contagem", async () => {
    const io = criarIo()
    expect(await executarComando(["--checkpoint", "c1-base", "--listar"], io)).toBe(0)
    expect(io.chamados).toEqual([])
    expect(io.logs[0]).toContain("Casos do c1-base: 12")
  })

  it.each([
    ["c1-base", 12],
    ["c2-conversa", 54],
    ["c3-confiavel", 84],
  ])("--listar de %s mostra %i casos", async (nome, total) => {
    const io = criarIo()
    expect(await executarComando(["--checkpoint", nome, "--listar"], io)).toBe(0)
    expect(io.logs[0]).toContain(`Casos do ${nome}: ${total}`)
  })
})

function historicoComHoje(): string {
  return historicoDoDia("c1-base", HOJE)
}

function historicoDoDia(checkpoint: string, data: string): string {
  return JSON.stringify({
    versao: 1,
    checkpoints: [
      {
        checkpoint,
        data,
        prompts: PROMPTS,
        modelos: ["modelo-x"],
        casos: 12,
        casos_com_erro: 0,
        metricas: {},
        violacoes_da_1a: {},
        abaixo_da_meta: [],
        criticas: [],
      },
    ],
  })
}
