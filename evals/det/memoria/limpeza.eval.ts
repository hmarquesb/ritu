import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import { executarLimpeza } from "@/core/cleanup"
import type { Stores } from "@/core/stores"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"

const CONTA = "conta-1"
const DIA_EM_MS = 86_400_000
const MINUTO_EM_MS = 60_000
const INICIO = "2026-01-15T12:00:00-03:00"
const HOJE = "2026-01-15"
const SUGESTAO = { tipo: "cha" as const, titulo: "Chá de gengibre", alimentos: ["gengibre"] }

function ambiente() {
  const clock = createFixedClock(INICIO)
  const stores = createMemoryStores(clock)
  return { clock, stores }
}

type Relogio = ReturnType<typeof createFixedClock>

function limpar(stores: Stores, clock: Relogio) {
  return executarLimpeza({ stores, clock })
}

describe("mensagens (prazo em dias)", () => {
  it("no prazo fica; um minuto depois sai", async () => {
    const { clock, stores } = ambiente()
    await stores.messages.gravar(CONTA, {
      autor: "pessoa",
      texto: "oi",
      com_incomodo: false,
      dia: HOJE,
    })

    clock.advance(config.memoria.mensagensDias * DIA_EM_MS)
    expect((await limpar(stores, clock)).mensagens).toBe(0)
    expect(await stores.messages.doDia(CONTA, HOJE)).toHaveLength(1)

    clock.advance(MINUTO_EM_MS)
    expect((await limpar(stores, clock)).mensagens).toBe(1)
    expect(await stores.messages.doDia(CONTA, HOJE)).toHaveLength(0)
  })
})

describe("retornos aguardando (prazo em dias)", () => {
  it("aguardando com exatamente o prazo fica; com um minuto a mais sai", async () => {
    const { clock, stores } = ambiente()
    const run = await stores.runs.criar(CONTA, { caminho: "casa", intencoes: [], dia: HOJE })
    await stores.outcomes.criar(CONTA, run.id, [SUGESTAO])

    clock.advance(config.memoria.retornosDias * DIA_EM_MS)
    expect((await limpar(stores, clock)).retornos).toBe(0)
    expect(await stores.outcomes.pendentes(CONTA)).toHaveLength(1)

    clock.advance(MINUTO_EM_MS)
    expect((await limpar(stores, clock)).retornos).toBe(1)
    expect(await stores.outcomes.pendentes(CONTA)).toHaveLength(0)
  })
})

describe("faltas (prazo em dias, por dia da falta)", () => {
  // Hoje é 2026-01-15; o corte de 30 dias cai em 2025-12-16.
  it("falta do dia de corte fica; a do dia anterior sai, e o corte anda um dia por vez", async () => {
    const { clock, stores } = ambiente()
    await stores.shortages.registrar(
      CONTA,
      [{ alimento_id: "banana", origem: "nao_tenho" }],
      "2025-12-16",
    )
    await stores.shortages.registrar(
      CONTA,
      [{ alimento_id: "canela", origem: "nao_tenho" }],
      "2025-12-15",
    )

    expect((await limpar(stores, clock)).faltas).toBe(1)
    expect(await stores.shortages.diasComFalta(CONTA, "2000-01-01")).toEqual([
      { alimento_id: "banana", dias: 1, ultimo_dia: "2025-12-16" },
    ])

    clock.advance(DIA_EM_MS)
    expect((await limpar(stores, clock)).faltas).toBe(1)
    expect(await stores.shortages.diasComFalta(CONTA, "2000-01-01")).toEqual([])
  })
})

describe("espera de run (prazo em minutos)", () => {
  it("run em espera com exatamente o prazo fica; com um minuto a mais expira e leva a proposta", async () => {
    const { clock, stores } = ambiente()
    const run = await stores.runs.criar(CONTA, { caminho: "casa", intencoes: [], dia: HOJE })
    await stores.runs.atualizar(CONTA, run.id, { status: "waiting_for_approval" })
    await stores.proposals.criar(CONTA, run.id, [{ tool: "casa.registrar", conteudo: {} }])

    clock.advance(config.memoria.esperaMinutos * MINUTO_EM_MS)
    const no_prazo = await limpar(stores, clock)
    expect(no_prazo).toMatchObject({ runs_expirados: 0, propostas_expiradas: 0 })

    clock.advance(MINUTO_EM_MS)
    const passou = await limpar(stores, clock)
    expect(passou).toMatchObject({ runs_expirados: 1, propostas_expiradas: 1 })
    expect(await stores.runs.buscar(CONTA, run.id)).toMatchObject({ status: "expired" })
  })
})

describe("mensagem com incômodo (até o fim do dia)", () => {
  it("some no dia seguinte, não no mesmo dia", async () => {
    const { clock, stores } = ambiente()
    await stores.messages.gravar(CONTA, {
      autor: "pessoa",
      texto: "dói a cabeça",
      com_incomodo: true,
      dia: HOJE,
    })

    clock.set("2026-01-15T23:59:00-03:00")
    expect((await limpar(stores, clock)).mensagens_com_incomodo).toBe(0)

    clock.set("2026-01-16T00:00:00-03:00")
    expect((await limpar(stores, clock)).mensagens_com_incomodo).toBe(1)
  })
})

describe("evitar temporário (até o fim do dia)", () => {
  it("some no dia seguinte, não no mesmo dia", async () => {
    const { clock, stores } = ambiente()
    await stores.profiles.acrescentarEvitarTemporario(CONTA, HOJE, [{ tipo: "texto", valor: "x" }])

    clock.set("2026-01-15T23:59:00-03:00")
    expect((await limpar(stores, clock)).evitar_temporario).toBe(0)

    clock.set("2026-01-16T00:00:00-03:00")
    expect((await limpar(stores, clock)).evitar_temporario).toBe(1)
  })
})

describe("conta demo (vence no instante da expiração)", () => {
  it("antes de expirar fica; no instante da expiração sai", async () => {
    const { clock, stores } = ambiente()
    const expiraEm = new Date(Date.parse(INICIO) + 60 * MINUTO_EM_MS)
    await stores.accounts.criar({ tipo: "demo", expira_em: expiraEm })

    clock.set(new Date(expiraEm.getTime() - MINUTO_EM_MS).toISOString())
    expect((await limpar(stores, clock)).demos).toBe(0)

    clock.set(expiraEm.toISOString())
    expect((await limpar(stores, clock)).demos).toBe(1)
  })
})
