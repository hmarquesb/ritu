import { describe, expect, it } from "vitest"
import type { EntradaDoAcompanhante } from "@/core/agents/companion/entrada"
import { type DadosDoPreparo, preparar } from "@/core/agents/companion/preparo"
import { filtroVazio } from "@/core/knowledge/filtros"
import { qualidadesDoMomento } from "@/core/knowledge/momento"
import { montarCandidatos } from "@/core/ranking/candidatos"
import { faltasDoRun } from "@/core/ranking/faltas"
import type { Candidato } from "@/core/ranking/tipos"
import { getContainer } from "@/infra/container"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"

const kb = getContainer().knowledge
const CONTA = "conta-1"
const HOJE = "2026-11-15"
// 19h em São Paulo: momento "jantar".
const JANTAR = "2026-11-15T22:00:00.000Z"
const ESTADOS = ["com_frio", "pesada"] as const

function montar() {
  const clock = createFixedClock(JANTAR)
  const stores = createMemoryStores(clock)
  const deps = { stores, kb, clock, telemetry: createMemoryTelemetry() }
  const run = (parcial: Partial<EntradaDoAcompanhante> = {}): Promise<DadosDoPreparo> =>
    preparar(deps, CONTA, {
      intencoes: ["momento"],
      estados: [...ESTADOS],
      evitar_da_mensagem: [],
      ...parcial,
    })
  return { stores, run }
}

const itensDoCandidato = (c: Candidato) => [
  ...c.itens,
  ...Object.values(c.opcoes ?? {}).flatMap((itens) => itens ?? []),
]

const idsDosCandidatos = (lista: Candidato[]): string[] =>
  lista.flatMap((c) => itensDoCandidato(c).map((item) => item.alimento_id))

function candidatosSemRefeicao(): Candidato[] {
  const qualidades = qualidadesDoMomento({ estados: [...ESTADOS] }, kb)
  const todos = montarCandidatos(
    {
      qualidades,
      estados: [...ESTADOS],
      momento_do_dia: "jantar",
      filtro: filtroVazio,
      restricoes: [],
      casa: { confirmados: [], incertos: [] },
      preferencias: [],
      sugeridos_hoje: [],
    },
    kb,
  )
  return todos.filter((c) => c.tipo !== "refeicao")
}

// Os cinco candidatos mais adequados (sem refeição, cuja adequação é recalculada) e seus alimentos.
function cincoMaisAdequados(candidatos: Candidato[]): string[] {
  const ordenados = [...candidatos].sort(
    (a, b) => b.adequacao - a.adequacao || a.id.localeCompare(b.id) || a.tipo.localeCompare(b.tipo),
  )
  const ids = ordenados.slice(0, 5).flatMap((c) => c.itens.map((i) => i.alimento_id))
  return [...new Set(ids)].sort()
}

describe("falta só para alimento ausente entre os mais adequados", () => {
  const candidatos = candidatosSemRefeicao()
  const qualidades = qualidadesDoMomento({ estados: [...ESTADOS] }, kb)
  const semCasa = { confirmados: [], incertos: [] }

  it("sem casa, as faltas são os alimentos dos cinco candidatos mais adequados", () => {
    const faltas = faltasDoRun({ candidatos, casa: semCasa, buscadas: qualidades.buscadas }, kb)
    expect([...faltas].sort()).toEqual(cincoMaisAdequados(candidatos))
  })

  it("alimento confirmado em casa não é falta", () => {
    const esperado = cincoMaisAdequados(candidatos)
    const [primeiro, ...resto] = esperado
    expect(primeiro, "há faltas").toBeDefined()
    const faltas = faltasDoRun(
      {
        candidatos,
        casa: { confirmados: [primeiro ?? ""], incertos: [] },
        buscadas: qualidades.buscadas,
      },
      kb,
    )
    expect([...faltas].sort()).toEqual(resto)
  })

  it("alimento incerto em casa também não é falta", () => {
    const esperado = cincoMaisAdequados(candidatos)
    const faltas = faltasDoRun(
      {
        candidatos,
        casa: { confirmados: [], incertos: esperado },
        buscadas: qualidades.buscadas,
      },
      kb,
    )
    expect(faltas).toEqual([])
  })

  it("alimento fora dos cinco mais adequados não vira falta", () => {
    const dentro = new Set(cincoMaisAdequados(candidatos))
    const faltas = faltasDoRun({ candidatos, casa: semCasa, buscadas: qualidades.buscadas }, kb)
    for (const id of faltas) expect(dentro.has(id), id).toBe(true)
  })

  it("com refeições, toda falta é um alimento de algum candidato", () => {
    const todos = montarCandidatos(
      {
        qualidades,
        estados: [...ESTADOS],
        momento_do_dia: "jantar",
        filtro: filtroVazio,
        restricoes: [],
        casa: semCasa,
        preferencias: [],
        sugeridos_hoje: [],
      },
      kb,
    )
    const presentes = new Set(idsDosCandidatos(todos))
    const faltas = faltasDoRun(
      { candidatos: todos, casa: semCasa, buscadas: qualidades.buscadas },
      kb,
    )
    expect(faltas.length).toBeGreaterThan(0)
    for (const id of faltas) expect(presentes.has(id), id).toBe(true)
  })
})

describe("refeição com vaga obrigatória só ausente de casa", () => {
  it("sai dos candidatos do preparo, mas o alimento ausente continua nas faltas", async () => {
    const { stores, run } = montar()
    const confirmados = ["arroz-branco", "abobora", "ghee"]
    await stores.pantry.registrar(
      CONTA,
      confirmados.map((alimento_id) => ({ alimento_id })),
      "tela",
    )
    const dados = await run()

    const qualidades = qualidadesDoMomento({ estados: [...ESTADOS] }, kb)
    const todos = montarCandidatos(
      {
        qualidades,
        estados: [...ESTADOS],
        momento_do_dia: "jantar",
        filtro: filtroVazio,
        restricoes: [],
        casa: { confirmados, incertos: [] },
        preferencias: [],
        sugeridos_hoje: [],
      },
      kb,
    )
    const completa = todos.find((c) => c.id === "arroz-com-leguminosa")
    expect(completa, "a lista completa traz a refeição sem proteína em casa").toBeDefined()
    expect(dados.candidatos.map((c) => c.id)).not.toContain("arroz-com-leguminosa")

    const faltasDaLista = faltasDoRun(
      {
        candidatos: todos,
        casa: { confirmados, incertos: [] },
        buscadas: qualidades.buscadas,
      },
      kb,
    )
    expect(dados.faltas_do_run).toEqual(faltasDaLista)
    const ausentes = (completa ? itensDoCandidato(completa) : [])
      .filter((i) => i.casa === "ausente")
      .map((i) => i.alimento_id)
    expect(
      ausentes.some((id) => dados.faltas_do_run.includes(id)),
      "um alimento ausente da refeição filtrada continua contado como falta",
    ).toBe(true)
  })
})

describe("para ter: candidato com três dias de falta em trinta", () => {
  async function faltaDeHoje(): Promise<string> {
    const { run } = montar()
    const dados = await run()
    const alvo = dados.faltas_do_run[0]
    expect(alvo, "há falta do run para usar").toBeDefined()
    return alvo ?? ""
  }

  it("dois dias anteriores mais hoje dão para_ter com três dias", async () => {
    const alvo = await faltaDeHoje()
    const { run, stores } = montar()
    await stores.shortages.registrar(
      CONTA,
      [{ alimento_id: alvo, origem: "nao_tenho" }],
      "2026-11-14",
    )
    await stores.shortages.registrar(
      CONTA,
      [{ alimento_id: alvo, origem: "nao_tenho" }],
      "2026-11-13",
    )

    const dados = await run()
    expect(dados.para_ter?.alimento_id).toBe(alvo)
    expect(dados.para_ter?.vezes).toBe(3)
  })

  it("um dia anterior mais hoje são dois dias e não dão para_ter", async () => {
    const alvo = await faltaDeHoje()
    const { run, stores } = montar()
    await stores.shortages.registrar(
      CONTA,
      [{ alimento_id: alvo, origem: "nao_tenho" }],
      "2026-11-14",
    )

    const dados = await run()
    expect(dados.para_ter?.alimento_id).not.toBe(alvo)
  })

  it("dia dentro da janela de trinta conta; dia fora dela não", async () => {
    const alvo = await faltaDeHoje()
    const dentro = montar()
    await dentro.stores.shortages.registrar(
      CONTA,
      [{ alimento_id: alvo, origem: "nao_tenho" }],
      "2026-10-17",
    )
    await dentro.stores.shortages.registrar(
      CONTA,
      [{ alimento_id: alvo, origem: "nao_tenho" }],
      "2026-11-14",
    )
    expect((await dentro.run()).para_ter?.alimento_id).toBe(alvo)

    const fora = montar()
    await fora.stores.shortages.registrar(
      CONTA,
      [{ alimento_id: alvo, origem: "nao_tenho" }],
      "2026-10-16",
    )
    await fora.stores.shortages.registrar(
      CONTA,
      [{ alimento_id: alvo, origem: "nao_tenho" }],
      "2026-11-14",
    )
    expect((await fora.run()).para_ter?.alimento_id).not.toBe(alvo)
  })

  it("hoje conta uma vez só: registro de hoje mais um dia anterior dão dois, não três", async () => {
    const alvo = await faltaDeHoje()
    const { run, stores } = montar()
    await stores.shortages.registrar(CONTA, [{ alimento_id: alvo, origem: "nao_tenho" }], HOJE)
    await stores.shortages.registrar(
      CONTA,
      [{ alimento_id: alvo, origem: "nao_tenho" }],
      "2026-11-14",
    )

    expect((await run()).para_ter?.alimento_id).not.toBe(alvo)
  })

  describe("candidato filtrado, na lista ou recusado não vira para_ter", () => {
    async function comTresDias() {
      const alvo = await faltaDeHoje()
      const mundo = montar()
      await mundo.stores.shortages.registrar(
        CONTA,
        [{ alimento_id: alvo, origem: "nao_tenho" }],
        "2026-11-14",
      )
      await mundo.stores.shortages.registrar(
        CONTA,
        [{ alimento_id: alvo, origem: "nao_tenho" }],
        "2026-11-13",
      )
      return { alvo, ...mundo }
    }

    it("controle: com três dias, o alimento vira para_ter", async () => {
      const { alvo, run } = await comTresDias()
      expect((await run()).para_ter?.alimento_id).toBe(alvo)
    })

    it("filtrado por evitar sempre", async () => {
      const { alvo, run, stores } = await comTresDias()
      await stores.profiles.acrescentarEvitarSempre(CONTA, [{ tipo: "alimento", valor: alvo }])
      expect((await run()).para_ter?.alimento_id).not.toBe(alvo)
    })

    it("já na lista de faltas", async () => {
      const { alvo, run, stores } = await comTresDias()
      await stores.shortages.porNaLista(CONTA, {
        alimento_id: alvo,
        motivo: "faltou_hoje",
        detalhe: "",
      })
      expect((await run()).para_ter?.alimento_id).not.toBe(alvo)
    })

    it("recusado numa proposta de lista", async () => {
      const { alvo, run, stores } = await comTresDias()
      const run0 = await stores.runs.criar(CONTA, {
        caminho: "acompanhante",
        intencoes: ["momento"],
        dia: HOJE,
      })
      const [proposta] = await stores.proposals.criar(CONTA, run0.id, [
        { tool: "lista.propor", conteudo: { alimento_id: alvo } },
      ])
      expect(proposta, "proposta criada").toBeDefined()
      if (proposta) await stores.proposals.decidir(CONTA, proposta.id, "recusada")

      expect((await run()).para_ter?.alimento_id).not.toBe(alvo)
    })
  })

  it("com incômodo, o run não recebe para_ter", async () => {
    const alvo = await faltaDeHoje()
    const { run, stores } = montar()
    await stores.shortages.registrar(
      CONTA,
      [{ alimento_id: alvo, origem: "nao_tenho" }],
      "2026-11-14",
    )
    await stores.shortages.registrar(
      CONTA,
      [{ alimento_id: alvo, origem: "nao_tenho" }],
      "2026-11-13",
    )

    const dados = await run({ incomodo: { id: "dor-de-cabeca", variante: "tensa" } })
    expect(dados.para_ter).toBeUndefined()
  })
})
