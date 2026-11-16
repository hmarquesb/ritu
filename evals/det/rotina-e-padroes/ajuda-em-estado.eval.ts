import { describe, expect, it } from "vitest"
import type { Estado } from "@/core/knowledge/vocab"
import type { Resultado } from "@/core/outcomes/ports"
import { detectarAjudaEmEstado, type RetornoRegistrado } from "@/core/patterns/detectar"
import { detectarPadroesDaConta } from "@/core/patterns/job"
import type { ItemDoPadrao } from "@/core/patterns/textos"
import { getContainer } from "@/infra/container"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"

// "O que ajuda em um estado": as bordas (3 ocorrências, 75%), o que não conta, uma chave por sugestão e o título mais recente.
const kb = getContainer().knowledge
const AGORA = "2026-06-03T20:00:00Z"
const DIA_MS = 86_400_000
const CHA: ItemDoPadrao = { tipo: "pratica", id: "cha-gengibre-canela" }
const OUTRO: ItemDoPadrao = { tipo: "preparo", id: "oleo-gergelim-morno" }
const TITULO = "Chá de gengibre com canela"
const PAR: Estado[] = ["com_frio", "agitada"]
const CHAVE_DO_PAR = "com_frio+agitada|pratica:cha-gengibre-canela"

let sequencia = 0
function retorno(
  dia: string,
  estados: Estado[],
  resultado: "ajudou" | "nao_ajudou",
  extra: Partial<Pick<RetornoRegistrado, "item" | "titulo" | "respondido_em">> = {},
): RetornoRegistrado {
  sequencia += 1
  return {
    dia,
    estados: [...estados],
    item: extra.item ?? CHA,
    titulo: extra.titulo ?? TITULO,
    resultado,
    respondido_em: extra.respondido_em ?? `${dia}T10:${String(sequencia).padStart(2, "0")}:00Z`,
  }
}

function repetir(
  quantas: number,
  resultado: "ajudou" | "nao_ajudou",
  estados: Estado[],
  item: ItemDoPadrao = CHA,
): RetornoRegistrado[] {
  return Array.from({ length: quantas }, (_, i) =>
    retorno(`2026-10-${String(i + 1).padStart(2, "0")}`, estados, resultado, { item }),
  )
}

describe("ajuda em estado: as bordas de ocorrências e de consistência", () => {
  it("3 'ajudou' e 1 'não ajudou' (75%, exatamente na borda) valem, com ocorrências 3", () => {
    const padroes = detectarAjudaEmEstado([
      ...repetir(3, "ajudou", PAR),
      retorno("2026-10-09", PAR, "nao_ajudou"),
    ])

    expect(padroes).toEqual([
      expect.objectContaining({ chave: CHAVE_DO_PAR, ocorrencias: 3, tipo: "ajuda_em_estado" }),
    ])
  })

  it("2 'ajudou' não valem: o mínimo é 3 ocorrências", () => {
    expect(detectarAjudaEmEstado(repetir(2, "ajudou", PAR))).toEqual([])
  })

  it("3 'ajudou' e 2 'não ajudou' (60%) não valem", () => {
    const padroes = detectarAjudaEmEstado([
      ...repetir(3, "ajudou", PAR),
      retorno("2026-10-09", PAR, "nao_ajudou"),
      retorno("2026-10-10", PAR, "nao_ajudou"),
    ])

    expect(padroes).toEqual([])
  })
})

describe("ajuda em estado: estado sozinho e par", () => {
  it("um estado sozinho com 3 'ajudou' vale com a chave de um estado", () => {
    const padroes = detectarAjudaEmEstado(repetir(3, "ajudou", ["com_frio"]))

    expect(padroes.map((p) => p.chave)).toEqual(["com_frio|pratica:cha-gengibre-canela"])
  })

  it("com o par valendo, a chave é o par, e o estado sozinho não aparece", () => {
    const padroes = detectarAjudaEmEstado(repetir(3, "ajudou", PAR))

    expect(padroes.map((p) => p.chave)).toEqual([CHAVE_DO_PAR])
  })
})

describe("ajuda em estado: uma chave por sugestão", () => {
  it("uma sugestão com o par e um estado valendo sai com uma só chave: a de mais 'ajudou' (6 contra 3)", () => {
    const padroes = detectarAjudaEmEstado([
      ...repetir(3, "ajudou", PAR),
      ...repetir(3, "ajudou", ["com_frio"]),
    ])

    expect(padroes).toHaveLength(1)
    expect(padroes[0]?.chave).toBe("com_frio|pratica:cha-gengibre-canela")
  })

  it("duas sugestões diferentes saem uma chave cada", () => {
    const padroes = detectarAjudaEmEstado([
      ...repetir(3, "ajudou", PAR),
      ...repetir(3, "ajudou", PAR, OUTRO),
    ])

    expect(padroes.map((p) => p.chave)).toEqual([
      CHAVE_DO_PAR,
      "com_frio+agitada|preparo:oleo-gergelim-morno",
    ])
  })
})

describe("ajuda em estado: o título é o do retorno mais recente", () => {
  it("o título vem do retorno respondido por último, mesmo quando não é o primeiro da lista", () => {
    const padroes = detectarAjudaEmEstado([
      retorno("2026-10-01", PAR, "ajudou", {
        titulo: "Chá antigo",
        respondido_em: "2026-10-01T10:00:00Z",
      }),
      retorno("2026-10-03", PAR, "ajudou", {
        titulo: "Chá novo",
        respondido_em: "2026-10-03T10:00:00Z",
      }),
      retorno("2026-10-02", PAR, "ajudou", {
        titulo: "Chá do meio",
        respondido_em: "2026-10-02T10:00:00Z",
      }),
    ])

    expect(padroes[0]?.frase).toBe(
      "Quando você está com frio e agitada, chá novo costuma te ajudar.",
    )
  })
})

// Pelo job, sobre stores semeados: o que não conta vem de como a conta respondeu e de onde a pessoa estava.
type Dia = {
  diasAtras: number
  estados: Estado[]
  resultado?: Resultado
  incomodo?: boolean
  titulo?: string
}

function montar() {
  const clock = createFixedClock(AGORA)
  const stores = createMemoryStores(clock, { alimentoExiste: (id) => Boolean(kb.alimento(id)) })
  const telemetry = createMemoryTelemetry()
  return { clock, stores, telemetry, deps: { stores, kb, clock, telemetry } }
}

async function semear(m: ReturnType<typeof montar>, contaId: string, dias: Dia[]): Promise<void> {
  for (const d of dias) {
    m.clock.set(new Date(Date.parse(AGORA) - d.diasAtras * DIA_MS).toISOString())
    const dia = m.clock.now().toISOString().slice(0, 10)
    const run = await m.stores.runs.criar(contaId, { caminho: "acompanhante", intencoes: [], dia })
    await m.stores.runs.atualizar(contaId, run.id, {
      status: "done",
      com_incomodo: d.incomodo ?? false,
      momento: { estados: d.estados, momento_do_dia: "noite", gunas_buscadas: [] },
    })
    if (d.resultado) {
      const sugestao = {
        tipo: "cha" as const,
        pratica_id: CHA.id,
        alimentos: [],
        titulo: d.titulo ?? TITULO,
      }
      const [r] = await m.stores.outcomes.criar(contaId, run.id, [sugestao])
      if (r) await m.stores.outcomes.responder(contaId, r.id, d.resultado, "toque")
    }
  }
  m.clock.set(AGORA)
}

async function ajudas(m: ReturnType<typeof montar>, contaId: string) {
  await detectarPadroesDaConta(m.deps, contaId)
  return (await m.stores.patterns.listar(contaId)).filter((p) => p.tipo === "ajuda_em_estado")
}

const HISTORICO_COM_PAR = (resultado: Resultado): Dia[] => [
  { diasAtras: 2, estados: PAR, resultado },
  { diasAtras: 3, estados: PAR, resultado },
  { diasAtras: 4, estados: PAR, resultado },
]

describe("ajuda em estado pelo job: o que não conta", () => {
  it("'não fiz' não é 'não ajudou': 3 'ajudou' e 3 'não fiz' ainda valem", async () => {
    const m = montar()
    await semear(m, "c1", [
      ...HISTORICO_COM_PAR("ajudou"),
      { diasAtras: 5, estados: PAR, resultado: "nao_fez" },
      { diasAtras: 6, estados: PAR, resultado: "nao_fez" },
      { diasAtras: 7, estados: PAR, resultado: "nao_fez" },
    ])

    expect((await ajudas(m, "c1")).map((p) => p.chave)).toEqual([CHAVE_DO_PAR])
  })

  it("run com incômodo não conta: 3 'ajudou' nele não propõem o padrão", async () => {
    const m = montar()
    await semear(
      m,
      "c1",
      HISTORICO_COM_PAR("ajudou").map((d) => ({ ...d, incomodo: true })),
    )

    expect(await ajudas(m, "c1")).toEqual([])
  })

  it("o mesmo histórico sem incômodo propõe (o controle do caso acima)", async () => {
    const m = montar()
    await semear(m, "c1", HISTORICO_COM_PAR("ajudou"))

    expect((await ajudas(m, "c1")).map((p) => p.chave)).toEqual([CHAVE_DO_PAR])
  })

  it("com o título do retorno mais recente, a frase do padrão usa esse título", async () => {
    const m = montar()
    await semear(m, "c1", [
      { diasAtras: 4, estados: PAR, resultado: "ajudou", titulo: "Chá antigo" },
      { diasAtras: 3, estados: PAR, resultado: "ajudou", titulo: "Chá do meio" },
      { diasAtras: 2, estados: PAR, resultado: "ajudou", titulo: "Chá novo" },
    ])

    const [padrao] = await ajudas(m, "c1")
    expect(padrao?.frase).toBe("Quando você está com frio e agitada, chá novo costuma te ajudar.")
  })
})
