import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import { RituError } from "@/core/errors"
import type { Estado } from "@/core/knowledge/vocab"
import type { Resultado } from "@/core/outcomes/ports"
import { detectarPadroes, detectarPadroesDaConta } from "@/core/patterns/job"
import { getContainer } from "@/infra/container"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { montarCenario } from "../../../test/fixtures/cenarios"
import { padraoConfirmado } from "../../../test/fixtures/cenarios/padrao-confirmado"

// O job de detecção: o que não se propõe (recusado, sugestão e par já guardados, filtro, teto de candidatos), a falha de uma conta que não para as outras, nenhuma chamada de modelo e nenhuma leitura de mensagens.

const kb = getContainer().knowledge
const AGORA = "2026-06-03T20:00:00Z"
const DIA_MS = 86_400_000
type ItemDePratica = { tipo: "pratica"; id: string }
const CHA: ItemDePratica = { tipo: "pratica", id: "cha-gengibre-canela" }
const TITULO = "Chá de gengibre com canela"
const PAR: Estado[] = ["com_frio", "agitada"]
// Um estado sozinho: só a sugestão vira padrão (com dois estados juntos o par também viraria).
const SOZINHO: Estado[] = ["com_frio"]
const CHAVE_SOZINHO = "com_frio|cha"

type Dia = {
  diasAtras: number
  estados: Estado[]
  item?: ItemDePratica
  resultado?: Resultado
  incomodo?: boolean
}

function montar() {
  const clock = createFixedClock(AGORA)
  const stores = createMemoryStores(clock, { alimentoExiste: (id) => Boolean(kb.alimento(id)) })
  const telemetry = createMemoryTelemetry()
  return { clock, stores, telemetry, deps: { stores, kb, clock, telemetry } }
}

type Montagem = ReturnType<typeof montar>

// Runs done com momento, no relógio do passado; com item e resultado, a sugestão e a resposta.
async function semear(m: Montagem, contaId: string, dias: Dia[]): Promise<void> {
  for (const d of dias) {
    m.clock.set(new Date(Date.parse(AGORA) - d.diasAtras * DIA_MS).toISOString())
    const dia = m.clock.now().toISOString().slice(0, 10)
    const run = await m.stores.runs.criar(contaId, { caminho: "acompanhante", intencoes: [], dia })
    await m.stores.runs.atualizar(contaId, run.id, {
      status: "done",
      com_incomodo: d.incomodo ?? false,
      momento: { estados: d.estados, momento_do_dia: "noite", gunas_buscadas: [] },
    })
    if (d.item && d.resultado) {
      const sugestao = {
        tipo: "cha" as const,
        pratica_id: d.item.id,
        alimentos: [],
        titulo: TITULO,
      }
      const [r] = await m.stores.outcomes.criar(contaId, run.id, [sugestao])
      if (r) await m.stores.outcomes.responder(contaId, r.id, d.resultado, "toque")
    }
  }
  m.clock.set(AGORA)
}

// Três "ajudou" do item nos estados dados, em dias distintos a partir de `inicio` dias atrás.
function ajudou(estados: Estado[], item: ItemDePratica = CHA, inicio = 2): Dia[] {
  return [0, 1, 2].map((i) => ({
    diasAtras: inicio + i,
    estados,
    item,
    resultado: "ajudou" as const,
  }))
}

async function candidatos(m: Montagem, contaId: string) {
  return m.stores.patterns.listar(contaId, "candidato")
}

describe("job: o que não se propõe de novo", () => {
  it("um padrão recusado não volta: a detecção seguinte não propõe o mesmo", async () => {
    const m = montar()
    await semear(m, "c1", ajudou(SOZINHO))
    expect(await detectarPadroesDaConta(m.deps, "c1")).toBe(1)
    const [padrao] = await candidatos(m, "c1")
    if (!padrao) throw new Error("padrão não proposto")
    await m.stores.patterns.decidir("c1", padrao.id, "recusado")

    expect(await detectarPadroesDaConta(m.deps, "c1")).toBe(0)
    expect(await candidatos(m, "c1")).toEqual([])
    expect(await m.stores.patterns.listar("c1")).toHaveLength(1)
  })

  it("sugestão já guardada com um estado em comum não é proposta de novo", async () => {
    const m = montar()
    await m.stores.patterns.propor("c1", {
      tipo: "ajuda_em_estado",
      chave: "com_frio|cha",
      frase: "Quando você está com frio, um chá costuma te ajudar.",
      ocorrencias: 3,
    })
    await semear(m, "c1", ajudou(["com_frio"]))

    expect(await detectarPadroesDaConta(m.deps, "c1")).toBe(0)
    expect((await candidatos(m, "c1")).map((p) => p.chave)).toEqual(["com_frio|cha"])
  })

  it("controle: a mesma sugestão sem estado em comum com o guardado é proposta", async () => {
    const m = montar()
    await m.stores.patterns.propor("c1", {
      tipo: "ajuda_em_estado",
      chave: "com_frio|cha",
      frase: "Quando você está com frio, um chá costuma te ajudar.",
      ocorrencias: 3,
    })
    await semear(m, "c1", ajudou(["agitada"]))

    expect(await detectarPadroesDaConta(m.deps, "c1")).toBe(1)
    expect((await candidatos(m, "c1")).map((p) => p.chave)).toContain("agitada|cha")
  })

  it("par já guardado não é proposto, nem no sentido guardado nem no contrário", async () => {
    const m = montar()
    await m.stores.patterns.propor("c1", {
      tipo: "estados_juntos",
      chave: "agitada>com_frio",
      frase: "Quando você está agitada, costuma estar também com frio.",
      ocorrencias: 3,
    })
    await semear(m, "c1", [
      { diasAtras: 2, estados: PAR },
      { diasAtras: 3, estados: PAR },
      { diasAtras: 4, estados: PAR },
    ])

    expect(await detectarPadroesDaConta(m.deps, "c1")).toBe(0)
    expect((await candidatos(m, "c1")).map((p) => p.chave)).toEqual(["agitada>com_frio"])
  })
})

describe("job: teto de candidatos abertos", () => {
  it("com mais padrões do que o teto, só o teto vira candidato; de novo, nenhum a mais", async () => {
    const m = montar()
    const itens = [
      "oleo-pes-gergelim",
      "oleo-pes-coco",
      "oleo-barriga-gergelim",
      "oleo-corpo-gergelim",
    ]
    for (const id of itens) {
      await semear(m, "c1", ajudou(["com_frio"], { tipo: "pratica", id }, 2))
    }

    const primeira = await detectarPadroesDaConta(m.deps, "c1")
    expect(primeira).toBe(config.padroes.maxCandidatosAbertos)
    expect(await candidatos(m, "c1")).toHaveLength(config.padroes.maxCandidatosAbertos)

    expect(await detectarPadroesDaConta(m.deps, "c1")).toBe(0)
    expect(await candidatos(m, "c1")).toHaveLength(config.padroes.maxCandidatosAbertos)
  })
})

describe("job: o filtro da pessoa", () => {
  it("item barrado pelo filtro (nao come o óleo de gergelim) não é proposto", async () => {
    const m = montar()
    await m.stores.profiles.definirNaoCome("c1", [{ tipo: "alimento", valor: "oleo-de-gergelim" }])
    await semear(m, "c1", ajudou(SOZINHO, { tipo: "pratica", id: "oleo-pes-gergelim" }))

    expect(await detectarPadroesDaConta(m.deps, "c1")).toBe(0)
    expect(await candidatos(m, "c1")).toEqual([])
  })

  it("controle: sem o nao come, o mesmo histórico propõe", async () => {
    const m = montar()
    await semear(m, "c1", ajudou(SOZINHO))

    expect(await detectarPadroesDaConta(m.deps, "c1")).toBe(1)
    expect((await candidatos(m, "c1")).map((p) => p.chave)).toEqual([CHAVE_SOZINHO])
  })
})

describe("job: falha de uma conta não para as outras", () => {
  it("a conta que falha conta como falha e a outra segue com o padrão proposto", async () => {
    const m = montar()
    await semear(m, "c1", ajudou(SOZINHO))
    await semear(m, "c2", ajudou(SOZINHO))
    const quebrado = {
      ...m.stores,
      outcomes: {
        ...m.stores.outcomes,
        respondidosDesde: async (contaId: string, desde: Date) => {
          if (contaId === "c1") throw new RituError("falha_simulada", "falha simulada")
          return m.stores.outcomes.respondidosDesde(contaId, desde)
        },
      },
    }

    const r = await detectarPadroes({
      stores: quebrado,
      kb,
      clock: m.clock,
      telemetry: m.telemetry,
    })

    expect(r).toEqual({ contas: 2, propostos: 1, falhas: 1 })
    expect((await candidatos(m, "c2")).map((p) => p.chave)).toEqual([CHAVE_SOZINHO])
    expect(await candidatos(m, "c1")).toEqual([])
    expect(m.telemetry.logs).toContainEqual(
      expect.objectContaining({
        nivel: "error",
        codigo: "padroes_conta_falhou",
        campos: { "erro.codigo": "falha_simulada" },
      }),
    )
  })
})

describe("job: sem modelo e sem ler mensagens", () => {
  it("a detecção não chama modelo nem runtime", async () => {
    const llm = createFakeLlm([])
    const runtime = createScriptedRuntime([])
    const c = { ...padraoConfirmado, aprovacao: undefined, depois: undefined }
    const { contaId, deps } = await montarCenario(c, { llm, runtime })

    expect(await deps.stores.patterns.listar(contaId, "candidato")).toHaveLength(1)
    expect(llm.pedidos).toEqual([])
    expect(runtime.pedidos).toEqual([])
  })

  it("a detecção não lê o store de mensagens", async () => {
    const m = montar()
    await semear(m, "c1", ajudou(SOZINHO))
    const lendoMensagens = new Proxy(
      {},
      {
        get: () => {
          throw new Error("a detecção leu as mensagens")
        },
      },
    )
    const stores = { ...m.stores, messages: lendoMensagens as typeof m.stores.messages }

    expect(await detectarPadroesDaConta({ ...m.deps, stores }, "c1")).toBe(1)
    expect((await candidatos(m, "c1")).map((p) => p.chave)).toEqual([CHAVE_SOZINHO])
  })
})
