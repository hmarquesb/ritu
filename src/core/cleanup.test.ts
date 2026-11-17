import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import type { Stores } from "@/core/stores"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryLedger, createMemoryStores } from "@/infra/fakes/memory-stores"
import { executarLimpeza } from "./cleanup"

const T = "2026-01-15T12:00:00.000Z"
const HOJE = "2026-01-15"
const ONTEM = "2026-01-14"
const MINUTO = 60_000
const HORA_MS = 3_600_000
const DIA_MS = 86_400_000
const SUGESTAO = { tipo: "cha" as const, alimentos: ["gengibre"], titulo: "Chá de gengibre" }

function montar() {
  const clock = createFixedClock(T)
  const stores = createMemoryStores(clock)
  const ledger = createMemoryLedger(clock)
  const limiter = createMemoryLimiter()
  return { clock, stores, ledger, limiter }
}

// Instante T menos ms, em ISO, para o clock fixo.
function antes(ms: number): string {
  return new Date(Date.parse(T) - ms).toISOString()
}

async function criarConta(stores: Stores, nome: string): Promise<string> {
  const conta = await stores.accounts.criar({
    tipo: "google",
    google_sub: `sub-${nome}`,
    email: `${nome}@exemplo.com`,
  })
  return conta.id
}

async function criarRunEmEspera(stores: Stores, contaId: string): Promise<string> {
  const run = await stores.runs.criar(contaId, {
    caminho: "casa",
    intencoes: [],
    dia: HOJE,
  })
  await stores.runs.atualizar(contaId, run.id, { status: "waiting_for_input" })
  await stores.proposals.criar(contaId, run.id, [{ tool: "casa.registrar", conteudo: {} }])
  return run.id
}

describe("executarLimpeza", () => {
  it("sem dados devolve zeros", async () => {
    const { clock, stores, ledger, limiter } = montar()
    expect(await executarLimpeza({ stores, clock, ledger, limiter })).toEqual({
      mensagens: 0,
      mensagens_com_incomodo: 0,
      retornos: 0,
      faltas: 0,
      evitar_temporario: 0,
      runs_expirados: 0,
      propostas_expiradas: 0,
      demos: 0,
      llm_uso: 0,
      limites: 0,
    })
  })

  it("limites de hoje e de ontem ficam e os de anteontem saem", async () => {
    const { clock, stores, ledger, limiter } = montar()
    const teto = [{ chave: "usuario:a", teto: 100 }]
    clock.set("2026-01-13T12:00:00.000Z")
    await limiter.consumir(teto, "dia", "2026-01-13")
    clock.set("2026-01-14T12:00:00.000Z")
    await limiter.consumir(teto, "dia", "2026-01-14")
    clock.set(T)
    await limiter.consumir(teto, "dia", HOJE)
    await limiter.consumir([{ chave: "usuario:a", teto: 100 }], "minuto", "2026-01-15T11:59")

    const r = await executarLimpeza({ stores, clock, ledger, limiter })

    expect(r.limites).toBe(1)
    expect(await limiter.usado("usuario:a", "dia", "2026-01-13")).toBe(0)
    expect(await limiter.usado("usuario:a", "dia", ONTEM)).toBe(1)
    expect(await limiter.usado("usuario:a", "dia", HOJE)).toBe(1)
  })

  it("janela de uso de minuto com mais de 1 dia e de dia com mais de 30 dias saem; as recentes ficam", async () => {
    const { clock, stores, ledger, limiter } = montar()
    const modelo = Object.keys(config.llmCotas.modelos)[0] ?? ""
    const limites = { rpm: 100, tpm: 1_000_000, rpd: 1_000 }
    clock.set(antes(25 * HORA_MS))
    await ledger.reservar(modelo, limites)
    clock.set(antes(23 * HORA_MS))
    await ledger.reservar(modelo, limites)
    clock.set(antes(31 * DIA_MS))
    await ledger.reservar(modelo, limites)
    clock.set(T)

    const r = await executarLimpeza({ stores, clock, ledger, limiter })

    // minuto de 25 h, minuto de 31 dias e dia de 31 dias
    expect(r.llm_uso).toBe(3)
    clock.set(antes(23 * HORA_MS))
    const item = (await ledger.uso()).find((u) => u.modelo === modelo)
    expect(item).toMatchObject({ minuto: { pedidos: 1 }, dia: { pedidos: 2 } })
  })

  it("mensagem de 7 dias fica e a de 7 dias + 1 min sai", async () => {
    const { clock, stores, ledger, limiter } = montar()
    const a = await criarConta(stores, "a")
    clock.set(antes(7 * DIA_MS + MINUTO))
    await stores.messages.gravar(a, {
      autor: "pessoa",
      texto: "velha",
      com_incomodo: false,
      dia: "2026-01-07",
    })
    clock.set(antes(7 * DIA_MS))
    await stores.messages.gravar(a, {
      autor: "pessoa",
      texto: "no prazo",
      com_incomodo: false,
      dia: "2026-01-08",
    })
    clock.set(T)

    const r = await executarLimpeza({ stores, clock, ledger, limiter })

    expect(r.mensagens).toBe(1)
    expect(await stores.messages.doDia(a, "2026-01-07")).toEqual([])
    expect((await stores.messages.doDia(a, "2026-01-08")).map((m) => m.texto)).toEqual(["no prazo"])
  })

  it("mensagem com incômodo de ontem sai e a de hoje fica", async () => {
    const { clock, stores, ledger, limiter } = montar()
    const a = await criarConta(stores, "a")
    await stores.messages.gravar(a, {
      autor: "pessoa",
      texto: "ontem",
      com_incomodo: true,
      dia: ONTEM,
    })
    await stores.messages.gravar(a, {
      autor: "pessoa",
      texto: "hoje",
      com_incomodo: true,
      dia: HOJE,
    })

    const r = await executarLimpeza({ stores, clock, ledger, limiter })

    expect(r.mensagens_com_incomodo).toBe(1)
    expect(r.mensagens).toBe(0)
    expect(await stores.messages.doDia(a, ONTEM)).toEqual([])
    expect(await stores.messages.doDia(a, HOJE)).toHaveLength(1)
  })

  it("retorno aguardando de 8 dias sai e o respondido de 8 dias fica", async () => {
    const { clock, stores, ledger, limiter } = montar()
    const a = await criarConta(stores, "a")
    clock.set(antes(8 * DIA_MS))
    const run = await stores.runs.criar(a, { caminho: "casa", intencoes: [], dia: "2026-01-07" })
    await stores.outcomes.criar(a, run.id, [SUGESTAO])
    const [respondido] = await stores.outcomes.criar(a, run.id, [
      { ...SUGESTAO, titulo: "Outro chá" },
    ])
    await stores.outcomes.responder(a, respondido?.id ?? "", "ajudou", "toque")
    clock.set(T)

    const r = await executarLimpeza({ stores, clock, ledger, limiter })

    expect(r.retornos).toBe(1)
    const restantes = await stores.outcomes.doRun(a, run.id)
    expect(restantes).toHaveLength(1)
    expect(restantes[0]).toMatchObject({ status: "respondido", resultado: "ajudou" })
  })

  it("falta de 30 dias fica e a de 31 sai", async () => {
    const { clock, stores, ledger, limiter } = montar()
    const a = await criarConta(stores, "a")
    await stores.shortages.registrar(
      a,
      [{ alimento_id: "gengibre", origem: "nao_tenho" }],
      "2025-12-16",
    )
    await stores.shortages.registrar(
      a,
      [{ alimento_id: "cebola", origem: "nao_tenho" }],
      "2025-12-15",
    )

    const r = await executarLimpeza({ stores, clock, ledger, limiter })

    expect(r.faltas).toBe(1)
    const dias = await stores.shortages.diasComFalta(a, "2025-01-01")
    expect(dias.map((d) => d.alimento_id)).toEqual(["gengibre"])
  })

  it("evitar temporário de ontem sai e o de hoje fica", async () => {
    const { clock, stores, ledger, limiter } = montar()
    const a = await criarConta(stores, "a")
    await stores.profiles.acrescentarEvitarTemporario(a, ONTEM, [
      { tipo: "grupo", valor: "castanhas" },
    ])
    await stores.profiles.acrescentarEvitarTemporario(a, HOJE, [
      { tipo: "grupo", valor: "castanhas" },
    ])

    const r = await executarLimpeza({ stores, clock, ledger, limiter })

    expect(r.evitar_temporario).toBe(1)
    expect(await stores.profiles.evitarTemporario(a, ONTEM)).toEqual([])
    expect(await stores.profiles.evitarTemporario(a, HOJE)).toEqual([
      { tipo: "grupo", valor: "castanhas" },
    ])
  })

  it("run em espera há 31 min vira expired e a proposta pendente vira expirada; o de 29 min fica", async () => {
    const { clock, stores, ledger, limiter } = montar()
    const antigaConta = await criarConta(stores, "antiga")
    const recenteConta = await criarConta(stores, "recente")
    clock.set(antes(31 * MINUTO))
    const antigo = await criarRunEmEspera(stores, antigaConta)
    clock.set(antes(29 * MINUTO))
    const recente = await criarRunEmEspera(stores, recenteConta)
    clock.set(T)

    const r = await executarLimpeza({ stores, clock, ledger, limiter })

    expect(r.runs_expirados).toBe(1)
    expect(r.propostas_expiradas).toBe(1)
    expect((await stores.runs.buscar(antigaConta, antigo))?.status).toBe("expired")
    expect((await stores.proposals.doRun(antigaConta, antigo))[0]?.decisao).toBe("expirada")
    expect((await stores.runs.buscar(recenteConta, recente))?.status).toBe("waiting_for_input")
    expect((await stores.proposals.doRun(recenteConta, recente))[0]?.decisao).toBe("pendente")
  })

  it("conta de demonstração vencida sai e a válida fica", async () => {
    const { clock, stores, ledger, limiter } = montar()
    const vencida = await stores.accounts.criar({
      tipo: "demo",
      expira_em: new Date(Date.parse(T) - MINUTO),
    })
    const valida = await stores.accounts.criar({
      tipo: "demo",
      expira_em: new Date(Date.parse(T) + DIA_MS),
    })

    const r = await executarLimpeza({ stores, clock, ledger, limiter })

    expect(r.demos).toBe(1)
    expect(await stores.accounts.buscar(valida.id)).toBeDefined()
    expect(await stores.accounts.buscar(vencida.id)).toBeUndefined()
  })

  it("devolve a contagem de cada item", async () => {
    const { clock, stores, ledger, limiter } = montar()
    const a = await criarConta(stores, "a")
    const b = await criarConta(stores, "b")
    const c = await criarConta(stores, "c")

    clock.set(antes(8 * DIA_MS))
    await stores.messages.gravar(a, {
      autor: "pessoa",
      texto: "velha",
      com_incomodo: false,
      dia: "2026-01-07",
    })
    const run = await stores.runs.criar(b, { caminho: "casa", intencoes: [], dia: "2026-01-07" })
    await stores.outcomes.criar(b, run.id, [SUGESTAO])
    await stores.shortages.registrar(
      a,
      [{ alimento_id: "cebola", origem: "nao_tenho" }],
      "2025-12-15",
    )
    clock.set(antes(31 * MINUTO))
    await criarRunEmEspera(stores, c)
    clock.set(T)
    await stores.messages.gravar(a, {
      autor: "pessoa",
      texto: "ontem",
      com_incomodo: true,
      dia: ONTEM,
    })
    await stores.profiles.acrescentarEvitarTemporario(a, ONTEM, [
      { tipo: "grupo", valor: "castanhas" },
    ])
    await stores.accounts.criar({ tipo: "demo", expira_em: new Date(Date.parse(T) - MINUTO) })

    await limiter.consumir([{ chave: "usuario:a", teto: 100 }], "dia", "2026-01-10")
    expect(await executarLimpeza({ stores, clock, ledger, limiter })).toEqual({
      limites: 1,
      mensagens: 1,
      mensagens_com_incomodo: 1,
      retornos: 1,
      faltas: 1,
      evitar_temporario: 1,
      runs_expirados: 1,
      propostas_expiradas: 1,
      demos: 1,
      llm_uso: 0,
    })
  })
})
