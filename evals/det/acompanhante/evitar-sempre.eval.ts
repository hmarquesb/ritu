import { describe, expect, it } from "vitest"
import type { EntradaDoAcompanhante } from "@/core/agents/companion/entrada"
import { type DadosDoPreparo, preparar } from "@/core/agents/companion/preparo"
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
// 23h em São Paulo: momento "noite", em que os óleos de gergelim são sugeridos.
const NOITE = "2026-11-16T02:00:00.000Z"
const ESTADOS_DO_OLEO: EntradaDoAcompanhante["estados"] = ["com_frio", "seca"]

const GRUPOS = ["leite", "gergelim", "amendoim", "castanhas", "ovo", "soja", "trigo"] as const

const OLEOS_DE_GERGELIM = ["oleo-pes-gergelim", "oleo-barriga-gergelim", "oleo-corpo-gergelim"]

function montar(iso = JANTAR) {
  const clock = createFixedClock(iso)
  const stores = createMemoryStores(clock)
  const deps = { stores, kb, clock, telemetry: createMemoryTelemetry() }
  const run = (parcial: Partial<EntradaDoAcompanhante> = {}): Promise<DadosDoPreparo> =>
    preparar(deps, CONTA, {
      intencoes: ["momento"],
      estados: ["com_frio", "pesada"],
      evitar_da_mensagem: [],
      ...parcial,
    })
  return { stores, run }
}

const itensDoCandidato = (c: Candidato) => [
  ...c.itens,
  ...Object.values(c.opcoes ?? {}).flatMap((itens) => itens ?? []),
]

const idsDosCandidatos = (dados: DadosDoPreparo): string[] =>
  dados.candidatos.flatMap((c) => itensDoCandidato(c).map((item) => item.alimento_id))

describe("evitar sempre de grupo: nenhum candidato traz alimento do grupo", () => {
  it.each(GRUPOS)("grupo %s", async (grupo) => {
    const { stores, run } = montar()
    await stores.profiles.acrescentarEvitarSempre(CONTA, [{ tipo: "grupo", valor: grupo }])
    const dados = await run()

    expect(dados.candidatos.length, "há candidatos").toBeGreaterThan(0)
    for (const id of idsDosCandidatos(dados)) {
      expect(kb.alimento(id)?.grupos_evitar ?? [], id).not.toContain(grupo)
    }
  })

  it.each(OLEOS_DE_GERGELIM)("tira a prática de óleo %s", async (id) => {
    const { stores, run } = montar(NOITE)
    await stores.profiles.acrescentarEvitarSempre(CONTA, [{ tipo: "grupo", valor: "gergelim" }])
    const dados = await run({ estados: ESTADOS_DO_OLEO })

    expect(dados.candidatos.map((c) => c.id)).not.toContain(id)
  })

  it("controle: sem o grupo gergelim, algum óleo de gergelim aparece nos candidatos", async () => {
    const { run } = montar(NOITE)
    const dados = await run({ estados: ESTADOS_DO_OLEO })
    const ids = dados.candidatos.map((c) => c.id)
    expect(OLEOS_DE_GERGELIM.some((id) => ids.includes(id))).toBe(true)
  })

  it("controle: sem o grupo leite, algum candidato traz alimento de leite", async () => {
    const { run } = montar()
    const dados = await run()
    const comLeite = idsDosCandidatos(dados).filter((id) =>
      (kb.alimento(id)?.grupos_evitar ?? []).includes("leite"),
    )
    expect(comLeite.length).toBeGreaterThan(0)
  })
})

describe("evitar sempre de alimento", () => {
  it("tira o alimento e as práticas e preparos que o usam", async () => {
    const { stores, run } = montar()
    await stores.profiles.acrescentarEvitarSempre(CONTA, [{ tipo: "alimento", valor: "gengibre" }])
    const dados = await run()

    expect(idsDosCandidatos(dados)).not.toContain("gengibre")
    expect(dados.candidatos.map((c) => c.id)).not.toContain("cha-gengibre")
  })

  it("controle: sem evitar, o chá de gengibre entra", async () => {
    const { run } = montar()
    const dados = await run()
    expect(dados.candidatos.map((c) => c.id)).toContain("cha-gengibre")
  })
})

describe("item da mensagem", () => {
  it("filtra no mesmo run, fica em evitar_temporario e vale no run seguinte do dia", async () => {
    const { stores, run } = montar()
    const dados = await run({ evitar_da_mensagem: ["gengibre"] })

    expect(dados.filtro.evitar).toContainEqual({ tipo: "alimento", valor: "gengibre" })
    expect(idsDosCandidatos(dados)).not.toContain("gengibre")
    expect(await stores.profiles.evitarTemporario(CONTA, HOJE)).toEqual([
      { tipo: "alimento", valor: "gengibre" },
    ])

    const depois = await run()
    expect(idsDosCandidatos(depois)).not.toContain("gengibre")
  })

  it("não vai para evitar sempre", async () => {
    const { stores, run } = montar()
    await run({ evitar_da_mensagem: ["gengibre"] })

    const perfil = await stores.profiles.ler(CONTA)
    expect(perfil.evitar_sempre).toEqual([])
  })

  it("nenhum motivo é gravado: os itens guardados só têm tipo e valor", async () => {
    const { stores, run } = montar()
    const dados = await run({ evitar_da_mensagem: ["gengibre", "gergelim"] })

    const temporario = await stores.profiles.evitarTemporario(CONTA, HOJE)
    expect(temporario.length).toBe(2)
    for (const item of [...temporario, ...dados.filtro.evitar]) {
      expect(Object.keys(item).sort()).toEqual(["tipo", "valor"])
    }
  })
})

describe("registro de gosto ou de casa mais recente não devolve o item", () => {
  it("evitar sempre continua valendo depois de 'gosta' e de ter o alimento em casa", async () => {
    const { stores, run } = montar()
    await stores.profiles.acrescentarEvitarSempre(CONTA, [{ tipo: "alimento", valor: "gengibre" }])
    await stores.pantry.registrar(CONTA, [{ alimento_id: "gengibre" }], "tela")
    await stores.preferences.definirGosto(CONTA, { tipo: "alimento", id: "gengibre" }, "gosta")

    const dados = await run()
    expect(idsDosCandidatos(dados)).not.toContain("gengibre")
    expect(dados.candidatos.map((c) => c.id)).not.toContain("cha-gengibre")
  })

  it("evitar temporário continua valendo depois de 'gosta' e de ter o alimento em casa", async () => {
    const { stores, run } = montar()
    await run({ evitar_da_mensagem: ["gengibre"] })
    await stores.pantry.registrar(CONTA, [{ alimento_id: "gengibre" }], "tela")
    await stores.preferences.definirGosto(CONTA, { tipo: "alimento", id: "gengibre" }, "gosta")

    const dados = await run()
    expect(idsDosCandidatos(dados)).not.toContain("gengibre")
  })
})
