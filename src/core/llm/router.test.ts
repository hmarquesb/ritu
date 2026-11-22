import { llmCotas } from "@config/llm-cotas"
import { describe, expect, it } from "vitest"
import { RituError } from "@/core/errors"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { LlmError } from "./errors"
import type { UsageLedger } from "./ledger"
import { createModelRouter } from "./router"

const [decisao0, decisao1] = llmCotas.papeis.decisao
const [apoio0] = llmCotas.papeis.apoio
const [reforco0] = llmCotas.papeis.reforco

function setup(iso = "2026-06-01T20:00:10Z") {
  const clock = createFixedClock(iso)
  const ledger = createMemoryLedger(clock)
  const telemetry = createMemoryTelemetry()
  const router = createModelRouter({ ledger, clock, telemetry })
  return { clock, ledger, telemetry, router }
}

async function encher(
  ledger: ReturnType<typeof setup>["ledger"],
  modelo: keyof typeof llmCotas.modelos,
  n: number,
) {
  for (let i = 0; i < n; i++) await ledger.reservar(modelo, llmCotas.modelos[modelo])
}

describe("createModelRouter", () => {
  it("devolve o principal de cada papel com cota livre", async () => {
    const { router } = setup()
    expect((await router.paraPapel("decisao").proximo())?.modelo).toBe(decisao0)
    expect((await router.paraPapel("apoio").proximo())?.modelo).toBe(apoio0)
    expect((await router.paraPapel("reforco").proximo())?.modelo).toBe(reforco0)
  })

  it("troca por cota do minuto (pedidos), avisa e volta no minuto seguinte", async () => {
    const { router, ledger, clock, telemetry } = setup()
    const trocas: unknown[] = []
    const f = router.paraPapel("decisao", { aoTrocar: (t) => trocas.push(t) })
    await encher(ledger, decisao0, llmCotas.modelos[decisao0].rpm)
    const r = await f.proximo()
    expect(r).toEqual({ modelo: decisao1, troca: { de: decisao0, motivo: "cota" } })
    expect(trocas).toEqual([{ papel: "decisao", de: decisao0, para: decisao1, motivo: "cota" }])
    expect(
      telemetry.metricas.find((m) => m.nome === "ritu_llm_troca_de_modelo_total")?.rotulos,
    ).toEqual({ papel: "decisao", de: decisao0, para: decisao1, motivo: "cota" })
    clock.advance(60_000)
    const volta = await f.proximo()
    expect(volta).toEqual({ modelo: decisao0, troca: { de: decisao1, motivo: "cota" } })
    expect(trocas).toHaveLength(2)
  })

  it("troca por cota do minuto (tokens)", async () => {
    const { router, ledger } = setup()
    await ledger.registrarTokens(decisao0, llmCotas.modelos[decisao0].tpm)
    const r = await router.paraPapel("decisao").proximo()
    expect(r?.modelo).toBe(decisao1)
  })

  it("dia cheio tira o modelo até a virada do dia de LA", async () => {
    const { router, ledger, clock } = setup("2026-06-01T20:00:10Z")
    const f = router.paraPapel("decisao")
    await ledger.registrarRateLimit(decisao0)
    await ledger.registrarRateLimit(decisao0)
    await ledger.registrarRateLimit(decisao0)
    clock.advance(2 * 60 * 60_000)
    expect((await f.proximo())?.modelo).toBe(decisao1)
    // 2026-06-02T07:00Z = 00:00 em LA (PDT)
    clock.set("2026-06-02T07:00:30Z")
    expect((await f.proximo())?.modelo).toBe(decisao0)
  })

  it("rate_limit troca com motivo 429; o terceiro tira o modelo do dia", async () => {
    const { router, clock } = setup()
    const f = router.paraPapel("decisao")
    const erro = new LlmError("rate_limit", "429")
    expect((await f.proximo())?.modelo).toBe(decisao0)
    await f.falhou(decisao0, erro)
    expect(await f.proximo()).toEqual({ modelo: decisao1, troca: { de: decisao0, motivo: "429" } })
    clock.advance(60_000)
    await f.falhou(decisao0, erro)
    clock.advance(60_000)
    await f.falhou(decisao0, erro)
    clock.advance(60_000)
    expect((await f.proximo())?.modelo).toBe(decisao1)
    expect((await f.proximo())?.modelo).toBe(decisao1)
  })

  it("preferir com vaga é devolvido; sem vaga segue a lista do começo", async () => {
    const { router, ledger } = setup()
    expect((await router.paraPapel("decisao", { preferir: decisao1 }).proximo())?.modelo).toBe(
      decisao1,
    )
    await encher(ledger, decisao1, llmCotas.modelos[decisao1].rpm)
    expect((await router.paraPapel("decisao", { preferir: decisao1 }).proximo())?.modelo).toBe(
      decisao0,
    )
  })

  it("todos sem vaga: null, e temModelo é false sem mudar uso()", async () => {
    const { router, ledger } = setup()
    for (const m of llmCotas.papeis.apoio) await encher(ledger, m, llmCotas.modelos[m].rpm)
    expect(await router.temModelo("apoio")).toBe(false)
    const antes = await ledger.uso()
    expect(await router.paraPapel("apoio").proximo()).toBeNull()
    expect(await router.temModelo("apoio")).toBe(false)
    expect(await ledger.uso()).toEqual(antes)
    expect(await router.temModelo("decisao")).toBe(true)
  })

  it("temModelo não reserva", async () => {
    const { router, ledger } = setup()
    await router.temModelo("decisao")
    expect((await ledger.uso()).every((u) => u.minuto.pedidos === 0)).toBe(true)
  })

  it("configuração com modelo fora de modelos falha na criação", () => {
    const { ledger, clock, telemetry } = setup()
    const cotas = {
      ...llmCotas,
      papeis: { ...llmCotas.papeis, apoio: ["modelo-x"] },
    } as unknown as typeof llmCotas
    expect(() => createModelRouter({ ledger, clock, telemetry, cotas })).toThrow(RituError)
  })

  it("emite as métricas com os rótulos de D8", async () => {
    const { router, telemetry } = setup()
    const f = router.paraPapel("decisao")
    const r = await f.proximo()
    await f.usou(decisao0, { entrada: 10, saida: 5 }, 120)
    await f.falhou(decisao0, new LlmError("timeout", "t"))
    const m = telemetry.metricas
    expect(r?.modelo).toBe(decisao0)
    expect(m.find((x) => x.nome === "ritu_llm_chamadas_total")?.rotulos).toEqual({
      modelo: decisao0,
      papel: "decisao",
    })
    const tokens = m.filter((x) => x.nome === "ritu_tokens_total")
    expect(tokens.map((t) => [t.rotulos.direcao, t.valor])).toEqual([
      ["entrada", 10],
      ["saida", 5],
    ])
    expect(m.find((x) => x.nome === "ritu_llm_erros_total")?.rotulos).toEqual({
      modelo: decisao0,
      papel: "decisao",
      codigo: "timeout",
    })
    const cota = m.filter((x) => x.nome === "ritu_llm_cota_usada")
    expect(cota.map((c) => c.rotulos.janela)).toEqual(["minuto", "dia"])
    expect(cota[0]?.valor).toBeCloseTo(1 / llmCotas.modelos[decisao0].rpm)
  })

  it("usou grava a duração da chamada com modelo e papel", async () => {
    const { router, telemetry } = setup()
    const f = router.paraPapel("decisao")
    await f.proximo()
    await f.usou(decisao0, { entrada: 1, saida: 1 }, 345)
    const h = telemetry.metricas.filter((x) => x.nome === "ritu_llm_duracao_ms")
    expect(h).toEqual([
      {
        tipo: "histograma",
        nome: "ritu_llm_duracao_ms",
        valor: 345,
        rotulos: { modelo: decisao0, papel: "decisao" },
      },
    ])
  })

  it("troca de modelo gera o log com papel, de, para e motivo", async () => {
    const { router, ledger, telemetry } = setup()
    await encher(ledger, decisao0, llmCotas.modelos[decisao0].rpm)
    const f = router.paraPapel("decisao")
    await f.proximo()
    expect(telemetry.logs.filter((l) => l.codigo === "troca_de_modelo")).toEqual([
      {
        nivel: "warn",
        codigo: "troca_de_modelo",
        campos: { papel: "decisao", de: decisao0, para: decisao1, motivo: "cota" },
      },
    ])
  })

  it("papel sem vaga gera sem_modelo uma vez por null", async () => {
    const { router, ledger, telemetry } = setup()
    for (const m of llmCotas.papeis.apoio) await encher(ledger, m, llmCotas.modelos[m].rpm)
    const f = router.paraPapel("apoio")
    expect(await f.proximo()).toBeNull()
    expect(telemetry.logs.filter((l) => l.codigo === "sem_modelo")).toEqual([
      { nivel: "warn", codigo: "sem_modelo", campos: { papel: "apoio" } },
    ])
  })

  it("falhou gera llm_erro e soma a métrica uma vez", async () => {
    const { router, telemetry } = setup()
    const f = router.paraPapel("decisao")
    await f.falhou(decisao0, new LlmError("timeout", "t"))
    const campos = { modelo: decisao0, papel: "decisao", codigo: "timeout" }
    expect(telemetry.logs.filter((l) => l.codigo === "llm_erro")).toEqual([
      { nivel: "warn", codigo: "llm_erro", campos },
    ])
    expect(telemetry.metricas.filter((x) => x.nome === "ritu_llm_erros_total")).toHaveLength(1)
  })
})

async function gastarDia(
  ledger: ReturnType<typeof setup>["ledger"],
  clock: ReturnType<typeof setup>["clock"],
  modelo: keyof typeof llmCotas.modelos,
) {
  const limites = llmCotas.modelos[modelo]
  let feitos = 0
  while (feitos < limites.rpd) {
    for (let i = 0; i < limites.rpm && feitos < limites.rpd; i++, feitos++) {
      await ledger.reservar(modelo, limites)
    }
    clock.advance(60_000)
  }
}

describe("cotaDoDiaEsgotada", () => {
  it("falso com a cota do minuto cheia em todos os modelos", async () => {
    const { router, ledger } = setup()
    for (const m of llmCotas.papeis.decisao) await encher(ledger, m, llmCotas.modelos[m].rpm)
    expect(await router.cotaDoDiaEsgotada("decisao")).toBe(false)
  })

  it("verdadeiro com a cota do dia cheia em todos os modelos", async () => {
    const { router, ledger, clock } = setup()
    for (const m of llmCotas.papeis.decisao) await gastarDia(ledger, clock, m)
    expect(await router.cotaDoDiaEsgotada("decisao")).toBe(true)
  })

  it("falso com um modelo do papel ainda livre", async () => {
    const { router, ledger, clock } = setup()
    const [livre, ...cheios] = llmCotas.papeis.decisao
    for (const m of cheios) await gastarDia(ledger, clock, m)
    expect(livre).toBeDefined()
    expect(await router.cotaDoDiaEsgotada("decisao")).toBe(false)
  })

  it("verdadeiro com esgotado_ate dia em todos os modelos", async () => {
    const { router, ledger } = setup()
    for (const m of llmCotas.papeis.decisao) {
      for (let i = 0; i < llmCotas.rateLimitsParaEsgotarODia; i++) {
        await ledger.registrarRateLimit(m)
      }
    }
    expect(await router.cotaDoDiaEsgotada("decisao")).toBe(true)
  })

  it("um 429 do minuto não conta como cota do dia", async () => {
    const { router, ledger } = setup()
    for (const m of llmCotas.papeis.decisao) await ledger.registrarRateLimit(m)
    expect(await router.cotaDoDiaEsgotada("decisao")).toBe(false)
  })
})

// Ledger mínimo que conta por id de rota (o `uso()` dos ledgers reais lista só os modelos).
function ledgerPorRota(): UsageLedger {
  const pedidos = new Map<string, number>()
  const rateLimits = new Set<string>()
  return {
    async reservar(rota, limites) {
      const n = pedidos.get(rota) ?? 0
      if (rateLimits.has(rota) || n >= limites.rpm) return false
      pedidos.set(rota, n + 1)
      return true
    },
    async registrarTokens() {},
    async registrarRateLimit(rota) {
      rateLimits.add(rota)
    },
    async uso() {
      return [...pedidos].map(([modelo, n]) => ({
        modelo,
        minuto: { pedidos: n, tokens: 0 },
        dia: { pedidos: n, tokens: 0, rate_limits: 0 },
      }))
    },
    async apagarAntigas() {
      return 0
    },
  }
}

describe("createModelRouter com várias chaves", () => {
  function setupChaves() {
    const clock = createFixedClock("2026-06-01T20:00:10Z")
    const ledger = ledgerPorRota()
    const telemetry = createMemoryTelemetry()
    const router = createModelRouter({ ledger, clock, telemetry, chaves: [1, 2, 3] })
    return { ledger, telemetry, router }
  }

  it("a rota leva o sufixo da chave e o ledger recebe a rota", async () => {
    const { router, ledger } = setupChaves()
    const f = router.paraPapel("decisao")
    expect(await f.proximo()).toEqual({ modelo: `${decisao0}@1` })
    expect((await ledger.uso()).map((u) => u.modelo)).toEqual([`${decisao0}@1`])
  })

  it("429 na chave 1 passa para a chave 2 do mesmo modelo, com chave_de e chave_para", async () => {
    const { router, telemetry } = setupChaves()
    const trocas: unknown[] = []
    const f = router.paraPapel("decisao", { aoTrocar: (t) => trocas.push(t) })
    await f.proximo()
    await f.falhou(`${decisao0}@1`, new LlmError("rate_limit", "x"))
    const r = await f.proximo()
    expect(r?.modelo).toBe(`${decisao0}@2`)
    expect(trocas).toEqual([
      { papel: "decisao", de: decisao0, para: decisao0, motivo: "429", chave_de: 1, chave_para: 2 },
    ])
    expect(telemetry.metricas.find((m) => m.nome === "ritu_llm_cota_usada")?.rotulos.modelo).toBe(
      decisao0,
    )
  })

  it("cota esgotada nas três chaves passa para o modelo seguinte", async () => {
    const { router, ledger } = setupChaves()
    for (const n of [1, 2, 3]) {
      for (let i = 0; i < llmCotas.modelos[decisao0 as keyof typeof llmCotas.modelos].rpm; i++) {
        await ledger.reservar(`${decisao0}@${n}`, llmCotas.modelos[decisao0])
      }
    }
    const r = await router.paraPapel("decisao").proximo()
    expect(r?.modelo).toBe(`${decisao1}@1`)
  })

  it("preferir aceita modelo puro e id de rota", async () => {
    const { router } = setupChaves()
    expect((await router.paraPapel("decisao", { preferir: decisao1 }).proximo())?.modelo).toBe(
      `${decisao1}@1`,
    )
    expect(
      (await router.paraPapel("decisao", { preferir: `${decisao1}@2` }).proximo())?.modelo,
    ).toBe(`${decisao1}@2`)
  })

  it("usou() mede com o modelo sem sufixo", async () => {
    const { router, telemetry } = setupChaves()
    const f = router.paraPapel("decisao")
    await f.usou(`${decisao0}@2`, { entrada: 1, saida: 1 }, 5)
    const m = telemetry.metricas.find((x) => x.nome === "ritu_llm_chamadas_total")
    expect(m?.rotulos).toEqual({ modelo: decisao0, papel: "decisao" })
  })

  it("sem chaves, o ledger recebe o modelo puro", async () => {
    const { router, ledger } = setup()
    await router.paraPapel("decisao").proximo()
    const usados = (await ledger.uso()).filter((u) => u.dia.pedidos > 0)
    expect(usados.map((u) => u.modelo)).toEqual([decisao0])
  })

  describe("com o ledger em memória real", () => {
    function setupReal() {
      const clock = createFixedClock("2026-06-01T20:00:10Z")
      const ledger = createMemoryLedger(clock)
      const router = createModelRouter({
        ledger,
        clock,
        telemetry: createMemoryTelemetry(),
        chaves: [1, 2, 3],
      })
      return { ledger, router }
    }

    it("temModelo vê a cota de cada rota", async () => {
      const { router, ledger } = setupReal()
      const todas = llmCotas.papeis.reforco.flatMap((m) => [1, 2, 3].map((n) => `${m}@${n}`))
      for (const rota of todas) await ledger.registrarRateLimit(rota)
      expect(await router.temModelo("reforco")).toBe(false)
      const livre = `${llmCotas.papeis.reforco[0]}@3`
      const { ledger: outro, router: r2 } = setupReal()
      for (const rota of todas.filter((r) => r !== livre)) await outro.registrarRateLimit(rota)
      expect(await r2.temModelo("reforco")).toBe(true)
    })

    async function esgotarDia(ledger: UsageLedger, chaves: number[]) {
      for (const m of llmCotas.papeis.reforco) {
        for (const n of chaves) {
          for (let i = 0; i < llmCotas.rateLimitsParaEsgotarODia; i++) {
            await ledger.registrarRateLimit(`${m}@${n}`)
          }
        }
      }
    }

    it("cotaDoDiaEsgotada só vale com as três chaves de todo modelo cheias no dia", async () => {
      const cheio = setupReal()
      await esgotarDia(cheio.ledger, [1, 2, 3])
      expect(await cheio.router.cotaDoDiaEsgotada("reforco")).toBe(true)
      const parcial = setupReal()
      await esgotarDia(parcial.ledger, [1, 2])
      expect(await parcial.router.cotaDoDiaEsgotada("reforco")).toBe(false)
    })

    it("a métrica de cota sai com o modelo sem sufixo", async () => {
      const clock = createFixedClock("2026-06-01T20:00:10Z")
      const telemetry = createMemoryTelemetry()
      const router = createModelRouter({
        ledger: createMemoryLedger(clock),
        clock,
        telemetry,
        chaves: [1, 2, 3],
      })
      await router.paraPapel("decisao").proximo()
      const m = telemetry.metricas.find((x) => x.nome === "ritu_llm_cota_usada")
      expect(m?.rotulos.modelo).toBe(decisao0)
    })
  })
})
