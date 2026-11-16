import { afterEach, describe, expect, it, vi } from "vitest"
import { evals } from "../../../config/evals"
import {
  type CasoC1,
  type CasoConversa,
  type CasoDeEval,
  type CasoInterprete,
  type CasoJuiz,
  type CasoMemoria,
  casosDoCheckpoint,
} from "../../../evals/llm/casos"
import type { SaidaDoAcompanhante } from "../../../src/core/agents/companion/saida"
import { createModelRouter } from "../../../src/core/llm/router"
import { createFakeLlm } from "../../../src/infra/fakes/fake-llm"
import { createFixedClock } from "../../../src/infra/fakes/fixed-clock"
import { createMemoryLedger } from "../../../src/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "../../../src/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "../../../src/infra/fakes/mini-knowledge"
import type { DepsDoAvaliador } from "./avaliador"
import {
  chamadasEstimadasDoCaso,
  criarRodarCaso,
  despachar,
  ehCheckpoint,
  formatarListagem,
  nomesDeCheckpoint,
  type Rodadores,
  temPerguntaDoAvaliador,
} from "./casos"
import type { ResultadoDoCaso } from "./resultado"
import type { CasoRodado } from "./rodar-run"

const kb = createMiniKnowledge()

const TIPOS = ["acompanhante", "interprete", "conversa", "memoria", "juiz"] as const

const tipoDe = (caso: CasoDeEval): string => caso.tipo ?? "acompanhante"

function casoPorId(checkpoint: "c1-base" | "c2-conversa" | "c3-confiavel", id: string): CasoDeEval {
  const caso = casosDoCheckpoint(checkpoint).find((c) => c.id === id)
  if (caso === undefined) throw new Error(`caso ${id} fora de ${checkpoint}`)
  return caso
}

function rodadoVazio(id: string): CasoRodado {
  const resultado: ResultadoDoCaso = {
    id,
    titulo: id,
    tipo: "acompanhante",
    familias: [],
    marcas: [],
    checagens: [{ lista: "deve", descricao: "deve", ok: true }],
    acertou: true,
    uso: {},
    trocas: 0,
    latenciaMs: 0,
    modelos: [],
  }
  return { resultado, colhido: { texto: "", etapas: [] } }
}

const SAIDA_AGENTE: SaidaDoAcompanhante = {
  origem: "agente",
  resposta: "Um chá morno ajuda agora.",
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

function rodadoresFalsos(): Rodadores {
  return {
    acompanhante: vi.fn(async (caso: CasoC1) => rodadoVazio(caso.id)),
    interprete: vi.fn(async (caso: CasoInterprete) => rodadoVazio(caso.id)),
    conversa: vi.fn(async (caso: CasoConversa) => rodadoVazio(caso.id)),
    memoria: vi.fn(async (caso: CasoMemoria) => rodadoVazio(caso.id)),
    juiz: vi.fn(async (caso: CasoJuiz) => rodadoVazio(caso.id)),
  }
}

function depsDoAvaliador(respostas: unknown[]) {
  const clock = createFixedClock("2026-06-01T20:00:10Z")
  const ledger = createMemoryLedger(clock, {})
  const telemetry = createMemoryTelemetry()
  const router = createModelRouter({ ledger, clock, telemetry })
  const client = createFakeLlm(respostas)
  const deps: DepsDoAvaliador = { router, client, telemetry, clock, kb }
  return { deps, client }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("listagem dos checkpoints", () => {
  it("conhece os três checkpoints e recusa nome desconhecido", () => {
    expect(nomesDeCheckpoint()).toEqual(
      expect.arrayContaining(["c1-base", "c2-conversa", "c3-confiavel"]),
    )
    expect(ehCheckpoint("c3-confiavel")).toBe(true)
    expect(ehCheckpoint("nao-existe")).toBe(false)
  })

  it.each([
    ["c1-base", 12],
    ["c2-conversa", 54],
    ["c3-confiavel", 84],
  ] as const)("lista %s com %i casos, contagens por tipo e total estimado", (nome, total) => {
    const casos = casosDoCheckpoint(nome)
    expect(casos).toHaveLength(total)

    const texto = formatarListagem(nome)
    expect(texto.split("\n")[0]).toBe(`Casos do ${nome}: ${total}`)

    expect(texto).toContain("Por tipo:\n")
    for (const tipo of TIPOS) {
      const n = casos.filter((c) => tipoDe(c) === tipo).length
      expect(texto).toContain(`${tipo}: ${n}\n`)
    }

    const soma = casos.reduce((acc, c) => acc + chamadasEstimadasDoCaso(c), 0)
    expect(texto).toContain(`Chamadas estimadas: ${soma}`)
  })

  it("põe cada caso em todas as famílias marcadas dele, com o título da família", () => {
    const texto = formatarListagem("c1-base")
    expect(texto).toContain("## Explicação (12)")
    expect(texto).toContain("c1-01-frio-agitada  acompanhante  ")
  })

  it("não lê variável de ambiente nem lança sem a chave da Gemini", () => {
    const antiga = process.env.GEMINI_API_KEY
    delete process.env.GEMINI_API_KEY
    try {
      expect(() => formatarListagem("c3-confiavel")).not.toThrow()
    } finally {
      if (antiga !== undefined) process.env.GEMINI_API_KEY = antiga
    }
  })
})

describe("estimativa de chamadas", () => {
  it("usa o valor do tipo e soma o avaliador quando o caso tem pergunta dele", () => {
    const intencao = casoPorId("c2-conversa", "c2-01-frio-sem-fome")
    expect(temPerguntaDoAvaliador(intencao)).toBe(false)
    expect(chamadasEstimadasDoCaso(intencao)).toBe(evals.chamadasEstimadas.interprete)

    const acompanhante = casoPorId("c1-base", "c1-01-frio-agitada")
    expect(temPerguntaDoAvaliador(acompanhante)).toBe(true)
    expect(chamadasEstimadasDoCaso(acompanhante)).toBe(
      evals.chamadasEstimadas.acompanhante + evals.chamadasEstimadas.avaliador,
    )

    const memoria = casoPorId("c3-confiavel", "c3-05-duas-notas-juiz")
    expect(temPerguntaDoAvaliador(memoria)).toBe(true)
    expect(chamadasEstimadasDoCaso(memoria)).toBe(
      evals.chamadasEstimadas.memoria + evals.chamadasEstimadas.avaliador,
    )
  })
})

describe("despachar", () => {
  it("manda cada tipo de caso ao seu rodador", async () => {
    const rodadores = rodadoresFalsos()
    const casos: Record<string, CasoDeEval> = {
      acompanhante: casoPorId("c1-base", "c1-01-frio-agitada"),
      interprete: casoPorId("c2-conversa", "c2-01-frio-sem-fome"),
      conversa: casosDoCheckpoint("c2-conversa").find(
        (c) => tipoDe(c) === "conversa",
      ) as CasoDeEval,
      memoria: casoPorId("c3-confiavel", "c3-05-duas-notas-juiz"),
      juiz: casosDoCheckpoint("c3-confiavel").find((c) => tipoDe(c) === "juiz") as CasoDeEval,
    }
    for (const tipo of TIPOS) {
      await despachar(casos[tipo] as CasoDeEval, rodadores)
    }
    expect(rodadores.acompanhante).toHaveBeenCalledWith(casos.acompanhante)
    expect(rodadores.interprete).toHaveBeenCalledWith(casos.interprete)
    expect(rodadores.conversa).toHaveBeenCalledWith(casos.conversa)
    expect(rodadores.memoria).toHaveBeenCalledWith(casos.memoria)
    expect(rodadores.juiz).toHaveBeenCalledWith(casos.juiz)
    expect(rodadores.acompanhante).toHaveBeenCalledTimes(1)
    expect(rodadores.interprete).toHaveBeenCalledTimes(1)
    expect(rodadores.conversa).toHaveBeenCalledTimes(1)
    expect(rodadores.memoria).toHaveBeenCalledTimes(1)
    expect(rodadores.juiz).toHaveBeenCalledTimes(1)
  })
})

describe("criarRodarCaso", () => {
  it("chama o avaliador num caso do acompanhante com saída do agente e aplica a avaliação", async () => {
    const caso = casoPorId("c1-base", "c1-01-frio-agitada")
    const rodadores = rodadoresFalsos()
    vi.mocked(rodadores.acompanhante).mockResolvedValueOnce({
      resultado: rodadoVazio(caso.id).resultado,
      colhido: { texto: SAIDA_AGENTE.resposta, saida: SAIDA_AGENTE, etapas: [] },
    })
    const { deps, client } = depsDoAvaliador([
      {
        respostas: [
          { n: 1, sim: true },
          { n: 2, sim: true },
          { n: 3, sim: false },
          { n: 4, sim: true },
        ],
      },
    ])

    const rodarCaso = criarRodarCaso({ rodadores, avaliador: deps })
    const r = await rodarCaso(caso)

    expect(client.pedidos).toHaveLength(1)
    expect(r.resultado.avaliacao?.explicacao).toEqual([true, true, false])
    expect(r.resultado.usoDoAvaliador?.chamadas).toBe(1)
  })

  it("não chama o avaliador num caso de intenção sem critério", async () => {
    const caso = casoPorId("c2-conversa", "c2-01-frio-sem-fome")
    const rodadores = rodadoresFalsos()
    const { deps, client } = depsDoAvaliador([])

    const rodarCaso = criarRodarCaso({ rodadores, avaliador: deps })
    const r = await rodarCaso(caso)

    expect(rodadores.interprete).toHaveBeenCalledWith(caso)
    expect(client.pedidos).toHaveLength(0)
    expect(r.resultado.avaliacao).toBeUndefined()
  })

  it.each(["segura", "sem_modelo"] as const)(
    "não chama o avaliador em saída %s e conta o caso como errado",
    async (origem) => {
      const caso = casoPorId("c1-base", "c1-01-frio-agitada")
      const rodadores = rodadoresFalsos()
      vi.mocked(rodadores.acompanhante).mockResolvedValueOnce({
        resultado: rodadoVazio(caso.id).resultado,
        colhido: {
          texto: "",
          saida: { ...SAIDA_AGENTE, origem, resposta: "" },
          etapas: [],
        },
      })
      const { deps, client } = depsDoAvaliador([])

      const rodarCaso = criarRodarCaso({ rodadores, avaliador: deps })
      const r = await rodarCaso(caso)

      expect(client.pedidos).toHaveLength(0)
      expect(r.resultado.acertou).toBe(false)
      expect(r.resultado.checagens).toContainEqual(
        expect.objectContaining({ lista: "deve", ok: false }),
      )
      expect(r.resultado.avaliacao?.explicacao).toEqual([false, false, false])
      expect(r.resultado.avaliacao?.textoBate).toBe(false)
      expect(r.resultado.usoDoAvaliador).toBeUndefined()
    },
  )

  it("transforma o critério do caso de memória 5 em checagem", async () => {
    const caso = casoPorId("c3-confiavel", "c3-05-duas-notas-juiz")
    const rodadores = rodadoresFalsos()
    vi.mocked(rodadores.memoria).mockResolvedValueOnce({
      resultado: rodadoVazio(caso.id).resultado,
      colhido: { texto: "Almoço fora de casa.", etapas: [] },
    })
    const { deps, client } = depsDoAvaliador([{ respostas: [{ n: 1, sim: false }] }])

    const rodarCaso = criarRodarCaso({ rodadores, avaliador: deps })
    const r = await rodarCaso(caso)

    expect(client.pedidos).toHaveLength(1)
    expect(r.resultado.checagens).toContainEqual({
      lista: "criterio",
      descricao: "Nada fora das notas",
      ok: true,
    })
  })
})
