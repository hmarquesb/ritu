import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import type { DemoSeed } from "@/core/demo-seed"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { criarDemonstracao, entrarComGoogle, LimiteDeDemonstracaoError } from "./entrar"

const kb = createMiniKnowledge()
const seed: DemoSeed = {
  faixa: "Faixa",
  mensagem_sugerida: "Oi",
  perfil: {
    prakriti: { vata: 0.5, pitta: 0.5 },
    cidade: { nome: "Rio de Janeiro", lat: -22.9, lon: -43.17, fuso: "America/Sao_Paulo" },
    evitar_sempre: [{ tipo: "texto", valor: "castanhas" }],
    restricoes: [],
    nao_come: [],
  },
  casa: [{ alimento_id: "gengibre", dias_atras: 1 }],
  preferencias: [],
  faltas: [],
  rotina: ["acordo cedo"],
  padrao: { estados: ["com_frio"], item: { tipo: "pratica", id: "cha-gengibre" }, ocorrencias: 3 },
  historico: [],
}
const { porIpPorDia, globalPorDia, duracaoHoras } = config.limites.demo

function montar() {
  const clock = createFixedClock("2026-03-10T15:00:00Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const limiter = createMemoryLimiter()
  return {
    clock,
    stores,
    telemetry,
    limiter,
    deps: { tx: stores, limiter, clock, kb, seed, telemetry },
  }
}

async function codigoDe(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p
  } catch (erro) {
    return (erro as { code?: string }).code
  }
  return undefined
}

describe("criarDemonstracao", () => {
  it("cria a conta com o perfil semeado e evitar_passo pronto", async () => {
    const { deps, stores, clock } = montar()
    const conta = await criarDemonstracao(deps, { ipHash: "a" })

    expect(conta.tipo).toBe("demo")
    expect(new Date(conta.expira_em ?? "").getTime()).toBe(
      clock.now().getTime() + duracaoHoras * 3_600_000,
    )
    const cheia = await stores.accounts.buscar(conta.id)
    expect(cheia?.evitar_passo).toBe("pronto")
    const perfil = await stores.profiles.ler(conta.id)
    expect(perfil.prakriti).toEqual(seed.perfil.prakriti)
    expect(perfil.cidade_nome).toBe(seed.perfil.cidade.nome)
    expect(perfil.evitar_sempre.map((e) => e.valor)).toEqual(["castanhas"])
    const casa = await stores.pantry.listar(conta.id)
    expect(casa.length).toBe(seed.casa.length)
    expect((await stores.routine.resumo(conta.id))?.texto).toBe("Acordo cedo.")
    expect(await stores.patterns.listar(conta.id, "candidato")).toHaveLength(1)
  })

  it("a sexta demonstração do mesmo ip lança demo_limite_ip sem criar conta", async () => {
    const { deps, telemetry } = montar()
    for (let i = 0; i < porIpPorDia; i++) await criarDemonstracao(deps, { ipHash: "a" })
    expect(await codigoDe(criarDemonstracao(deps, { ipHash: "a" }))).toBe("demo_limite_ip")
    expect(telemetry.metricas.at(-1)).toMatchObject({
      nome: "ritu_entrada_total",
      rotulos: { "conta.tipo": "demo", "entrada.resultado": "limite_ip" },
    })
  })

  it("a demonstração além do teto global lança demo_limite_global", async () => {
    const { deps, telemetry } = montar()
    for (let i = 0; i < globalPorDia; i++) await criarDemonstracao(deps, { ipHash: `ip${i}` })
    const erro = criarDemonstracao(deps, { ipHash: "novo" })
    expect(await codigoDe(erro)).toBe("demo_limite_global")
    expect(telemetry.metricas.at(-1)?.rotulos).toEqual({
      "conta.tipo": "demo",
      "entrada.resultado": "limite_global",
    })
  })

  it("o erro é LimiteDeDemonstracaoError", async () => {
    const { deps } = montar()
    for (let i = 0; i < porIpPorDia; i++) await criarDemonstracao(deps, { ipHash: "a" })
    await expect(criarDemonstracao(deps, { ipHash: "a" })).rejects.toBeInstanceOf(
      LimiteDeDemonstracaoError,
    )
  })

  it("com escopo, as chaves levam o prefixo", async () => {
    const { deps, limiter } = montar()
    await criarDemonstracao(deps, { ipHash: "a", escopo: "e2e" })
    expect(await limiter.usado("e2e:demo:ip:a", "dia", "2026-03-10")).toBe(1)
    expect(await limiter.usado("e2e:demo:global", "dia", "2026-03-10")).toBe(1)
    expect(await limiter.usado("demo:global", "dia", "2026-03-10")).toBe(0)
  })

  it("semSeed cria a conta sem perfil", async () => {
    const { deps, stores } = montar()
    const conta = await criarDemonstracao(deps, { ipHash: "a", semSeed: true })
    expect((await stores.profiles.ler(conta.id)).prakriti).toBeNull()
    expect((await stores.accounts.buscar(conta.id))?.evitar_passo).toBeNull()
    expect(await stores.pantry.listar(conta.id)).toEqual([])
  })

  it("falha no meio da cópia não deixa conta", async () => {
    const { deps, stores, clock } = montar()
    stores.routine.anotar = async () => {
      throw new Error("falhou")
    }
    await expect(criarDemonstracao(deps, { ipHash: "a" })).rejects.toThrow("falhou")
    clock.advance((duracaoHoras + 1) * 3_600_000)
    expect(await stores.accounts.apagarDemosVencidas()).toBe(0)
  })

  it("conta a métrica de demo nova", async () => {
    const { deps, telemetry } = montar()
    await criarDemonstracao(deps, { ipHash: "a" })
    expect(telemetry.metricas.at(-1)).toMatchObject({
      nome: "ritu_entrada_total",
      rotulos: { "conta.tipo": "demo", "entrada.resultado": "nova" },
    })
  })
})

describe("entrarComGoogle", () => {
  it("cria na primeira entrada e acha a mesma na segunda", async () => {
    const { stores, telemetry } = montar()
    const deps = { stores, telemetry, testers: [] }
    const a = await entrarComGoogle(deps, { sub: "s1", email: "a@x.com" })
    const b = await entrarComGoogle(deps, { sub: "s1", email: "a@x.com" })
    expect(b.id).toBe(a.id)
    expect(a.tipo).toBe("google")
    expect(telemetry.metricas.map((m) => m.rotulos)).toEqual([
      { "conta.tipo": "google", "entrada.resultado": "nova" },
      { "conta.tipo": "google", "entrada.resultado": "retorno" },
    ])
  })

  it("corrida por google_sub duplicado usa a conta encontrada", async () => {
    const { stores, telemetry } = montar()
    const existente = await stores.accounts.criar({
      tipo: "google",
      google_sub: "s2",
      email: "a@x.com",
    })
    let buscas = 0
    const original = stores.accounts.buscarPorGoogleSub
    stores.accounts.buscarPorGoogleSub = async (sub) => {
      buscas++
      return buscas === 1 ? undefined : original(sub)
    }
    stores.accounts.criar = async () => {
      throw new Error("duplicate key google_sub")
    }
    const conta = await entrarComGoogle(
      { stores, telemetry, testers: [] },
      { sub: "s2", email: "a@x.com" },
    )
    expect(conta.id).toBe(existente.id)
  })

  it("e-mail na lista de testers (com maiúsculas e espaços) grava tester: true", async () => {
    const { stores, telemetry } = montar()
    const conta = await entrarComGoogle(
      { stores, telemetry, testers: ["ana@x.com"] },
      { sub: "s3", email: "  Ana@X.com " },
    )
    expect(conta.tester).toBe(true)
    expect((await stores.accounts.buscar(conta.id))?.tester).toBe(true)
  })

  it("conta tester que sai da lista volta a tester: false na próxima entrada", async () => {
    const { stores, telemetry } = montar()
    const dados = { sub: "s4", email: "ana@x.com" }
    const primeira = await entrarComGoogle({ stores, telemetry, testers: ["ana@x.com"] }, dados)
    expect(primeira.tester).toBe(true)
    const depois = await entrarComGoogle({ stores, telemetry, testers: [] }, dados)
    expect(depois.id).toBe(primeira.id)
    expect(depois.tester).toBe(false)
    expect((await stores.accounts.buscar(primeira.id))?.tester).toBe(false)
  })

  it("sem mudança de situação, não chama marcar", async () => {
    const { stores, telemetry } = montar()
    const dados = { sub: "s5", email: "b@x.com" }
    await entrarComGoogle({ stores, telemetry, testers: [] }, dados)
    let marcacoes = 0
    const original = stores.accounts.marcar
    stores.accounts.marcar = async (...args) => {
      marcacoes++
      return original(...args)
    }
    await entrarComGoogle({ stores, telemetry, testers: [] }, dados)
    expect(marcacoes).toBe(0)
  })

  it("na corrida, também marca o tester da conta encontrada", async () => {
    const { stores, telemetry } = montar()
    const existente = await stores.accounts.criar({
      tipo: "google",
      google_sub: "s6",
      email: "ana@x.com",
    })
    let buscas = 0
    const original = stores.accounts.buscarPorGoogleSub
    stores.accounts.buscarPorGoogleSub = async (sub) => {
      buscas++
      return buscas === 1 ? undefined : original(sub)
    }
    stores.accounts.criar = async () => {
      throw new Error("duplicate key google_sub")
    }
    const conta = await entrarComGoogle(
      { stores, telemetry, testers: ["ana@x.com"] },
      { sub: "s6", email: "ana@x.com" },
    )
    expect(conta.id).toBe(existente.id)
    expect(conta.tester).toBe(true)
  })
})
