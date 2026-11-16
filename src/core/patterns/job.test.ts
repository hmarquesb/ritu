import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import type { Estado } from "@/core/knowledge/vocab"
import type { Resultado } from "@/core/outcomes/ports"
import type { Stores } from "@/core/stores"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { detectarPadroes, detectarPadroesDaConta } from "./job"

const AGORA = "2026-06-03T20:00:00Z"
const DIA_MS = 86_400_000
const CHA = {
  tipo: "cha" as const,
  pratica_id: "cha-gengibre",
  alimentos: [],
  titulo: "Chá",
}
const CHAVE_DO_CHA = "com_frio+agitada|pratica:cha-gengibre"

type Dia = {
  diasAtras: number
  estados: Estado[]
  resultado?: Resultado
  incomodo?: boolean
}

function setup() {
  const clock = createFixedClock(AGORA)
  const kb = createMiniKnowledge()
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  return { clock, kb, stores, telemetry }
}

async function semear(
  s: ReturnType<typeof setup>,
  contaId: string,
  dias: Dia[],
  stores: Stores = s.stores,
): Promise<void> {
  for (const d of dias) {
    s.clock.set(new Date(Date.parse(AGORA) - d.diasAtras * DIA_MS).toISOString())
    const dia = s.clock.now().toISOString().slice(0, 10)
    const run = await stores.runs.criar(contaId, { caminho: "acompanhante", intencoes: [], dia })
    await stores.runs.atualizar(contaId, run.id, {
      status: "done",
      com_incomodo: d.incomodo ?? false,
      momento: { estados: d.estados, momento_do_dia: "noite", gunas_buscadas: [] },
    })
    if (d.resultado) {
      const [r] = await stores.outcomes.criar(contaId, run.id, [CHA])
      if (r) await stores.outcomes.responder(contaId, r.id, d.resultado, "toque")
    }
  }
  s.clock.set(AGORA)
}

const FRIO_AGITADA: Estado[] = ["com_frio", "agitada"]
const HISTORICO_DO_CHA: Dia[] = [
  { diasAtras: 2, estados: FRIO_AGITADA, resultado: "ajudou" },
  { diasAtras: 3, estados: FRIO_AGITADA, resultado: "ajudou" },
  { diasAtras: 4, estados: FRIO_AGITADA, resultado: "ajudou" },
  { diasAtras: 5, estados: FRIO_AGITADA, resultado: "nao_ajudou" },
  { diasAtras: 6, estados: ["com_frio"] },
  { diasAtras: 7, estados: ["com_frio"] },
  { diasAtras: 8, estados: ["agitada"] },
  { diasAtras: 9, estados: ["agitada"] },
]

async function rodar(s: ReturnType<typeof setup>, contaId: string, dias: Dia[] = HISTORICO_DO_CHA) {
  await semear(s, contaId, dias)
  const deps = { stores: s.stores, kb: s.kb, clock: s.clock, telemetry: s.telemetry }
  return { deps, propostos: await detectarPadroesDaConta(deps, contaId) }
}

describe("detectarPadroesDaConta", () => {
  it("o histórico do chá propõe um candidato com a chave do par", async () => {
    const s = setup()
    const { propostos } = await rodar(s, "c1")
    const lista = await s.stores.patterns.listar("c1")
    expect(propostos).toBe(1)
    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({
      tipo: "ajuda_em_estado",
      chave: CHAVE_DO_CHA,
      status: "candidato",
      ocorrencias: 3,
    })
    expect(s.telemetry.metricas).toEqual([
      expect.objectContaining({
        nome: "ritu_padroes_total",
        rotulos: { tipo: "ajuda_em_estado", etapa: "detectado" },
      }),
    ])
  })

  it("run com incômodo não conta", async () => {
    const s = setup()
    const dias = HISTORICO_DO_CHA.map((d) => (d.resultado ? { ...d, incomodo: true } : d))
    expect((await rodar(s, "c1", dias)).propostos).toBe(0)
  })

  it('"não fiz" não conta', async () => {
    const s = setup()
    const dias = HISTORICO_DO_CHA.map((d) =>
      d.resultado === "ajudou" ? { ...d, resultado: "nao_fez" as const } : d,
    )
    expect((await rodar(s, "c1", dias)).propostos).toBe(0)
  })

  it("retorno de run fora da janela não conta", async () => {
    const s = setup()
    const dias = HISTORICO_DO_CHA.map((d) => ({ ...d, diasAtras: d.diasAtras + 59 }))
    expect((await rodar(s, "c1", dias)).propostos).toBe(0)
  })

  it("recusado guardado com a mesma chave não volta", async () => {
    const s = setup()
    const p = await s.stores.patterns.propor("c1", {
      tipo: "ajuda_em_estado",
      chave: CHAVE_DO_CHA,
      frase: "x",
      ocorrencias: 3,
    })
    await s.stores.patterns.decidir("c1", p?.id ?? "", "recusado")
    expect((await rodar(s, "c1")).propostos).toBe(0)
    expect(await s.stores.patterns.listar("c1")).toHaveLength(1)
  })

  it("padrão guardado do mesmo item com um estado em comum impede", async () => {
    const s = setup()
    await s.stores.patterns.propor("c1", {
      tipo: "ajuda_em_estado",
      chave: "com_frio|pratica:cha-gengibre",
      frase: "x",
      ocorrencias: 3,
    })
    expect((await rodar(s, "c1")).propostos).toBe(0)
  })

  it("par guardado em ordem contrária impede o estados_juntos", async () => {
    const s = setup()
    const juntos: Dia[] = [1, 2, 3, 4].map((n) => ({ diasAtras: n, estados: FRIO_AGITADA }))
    await s.stores.patterns.propor("c1", {
      tipo: "estados_juntos",
      chave: "agitada>com_frio",
      frase: "x",
      ocorrencias: 4,
    })
    expect((await rodar(s, "c1", juntos)).propostos).toBe(0)
    const s2 = setup()
    const { propostos } = await rodar(s2, "c1", juntos)
    expect(propostos).toBe(1)
    expect((await s2.stores.patterns.listar("c1"))[0]?.tipo).toBe("estados_juntos")
  })

  it("com 3 candidatos abertos não propõe", async () => {
    const s = setup()
    for (const chave of ["a>b", "c>d", "e>f"]) {
      await s.stores.patterns.propor("c1", {
        tipo: "estados_juntos",
        chave,
        frase: "x",
        ocorrencias: 3,
      })
    }
    expect(config.padroes.maxCandidatosAbertos).toBe(3)
    expect((await rodar(s, "c1")).propostos).toBe(0)
  })

  it("com 2 abertos propõe só um, o de mais ocorrências", async () => {
    const s = setup()
    for (const chave of ["a>b", "c>d"]) {
      await s.stores.patterns.propor("c1", {
        tipo: "estados_juntos",
        chave,
        frase: "x",
        ocorrencias: 3,
      })
    }
    // chá (3 ocorrências) e par (5 de 5 dias, sem os dias soltos) disputam a vaga.
    const dias: Dia[] = [
      ...HISTORICO_DO_CHA.filter((d) => d.resultado),
      { diasAtras: 10, estados: FRIO_AGITADA },
    ]
    const { propostos } = await rodar(s, "c1", dias)
    expect(propostos).toBe(1)
    const novos = (await s.stores.patterns.listar("c1")).filter((p) => p.chave.length > 4)
    expect(novos).toHaveLength(1)
    expect(novos[0]).toMatchObject({ tipo: "estados_juntos", ocorrencias: 5 })
  })

  it("item em evitar sempre não é proposto", async () => {
    const s = setup()
    await s.stores.profiles.acrescentarEvitarSempre("c1", [{ tipo: "alimento", valor: "gengibre" }])
    expect((await rodar(s, "c1")).propostos).toBe(0)
  })
})

describe("detectarPadroes", () => {
  it("erro numa conta não para as outras e soma em falhas", async () => {
    const s = setup()
    await semear(s, "ruim", HISTORICO_DO_CHA)
    await semear(s, "boa", HISTORICO_DO_CHA)
    const real = s.stores.runs.recentes.bind(s.stores.runs)
    s.stores.runs.recentes = async (contaId, desde, limite) => {
      if (contaId === "ruim") throw new Error("segredo: com_frio gengibre")
      return real(contaId, desde, limite)
    }
    const r = await detectarPadroes({
      stores: s.stores,
      kb: s.kb,
      clock: s.clock,
      telemetry: s.telemetry,
    })
    expect(r).toEqual({ contas: 2, propostos: 1, falhas: 1 })
    expect(s.telemetry.logs).toEqual([
      { nivel: "error", codigo: "padroes_conta_falhou", campos: { "erro.codigo": "desconhecido" } },
    ])
    expect(await s.stores.patterns.listar("boa")).toHaveLength(1)
  })

  it("não lê messages; o span e a métrica não têm chave, frase nem título", async () => {
    const s = setup()
    await semear(s, "c1", HISTORICO_DO_CHA)
    const proibido = new Proxy(
      {},
      {
        get() {
          throw new Error("messages lido")
        },
      },
    )
    const stores = Object.assign(Object.create(Object.getPrototypeOf(s.stores)), s.stores, {
      messages: proibido,
    }) as Stores
    const r = await detectarPadroes({ stores, kb: s.kb, clock: s.clock, telemetry: s.telemetry })
    expect(r).toEqual({ contas: 1, propostos: 1, falhas: 0 })
    expect(s.telemetry.spans).toHaveLength(1)
    expect(s.telemetry.spans[0]?.nome).toBe("padroes.deteccao")
    expect(s.telemetry.spans[0]?.atributos).toEqual({ "padroes.contas": 1, "padroes.propostos": 1 })
    const tudo = JSON.stringify([s.telemetry.spans, s.telemetry.metricas, s.telemetry.logs])
    for (const proibida of ["com_frio", "gengibre", "Chá", "Quando você"]) {
      expect(tudo).not.toContain(proibida)
    }
  })
})
