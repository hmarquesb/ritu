import { createHmac } from "node:crypto"
import { config } from "@config/index"
import { afterEach, describe, expect, it, vi } from "vitest"
import { criarDemonstracao, LimiteDeDemonstracaoError } from "@/core/accounts/entrar"
import { executarLimpeza } from "@/core/cleanup"
import type { UsageLimiter } from "@/core/limits/ports"
import type { Stores, Transactor } from "@/core/stores"
import { diaLocal } from "@/core/time/dia-local"
import { createContainer } from "@/infra/container"
import { createMemoryBastidores } from "@/infra/fakes/memory-bastidores"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryLedger, createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"

const AGORA = new Date("2026-03-10T15:00:00.000Z")
const HORA_MS = 3_600_000
const SEGREDO = "segredo-do-eval"
const IP = "203.0.113.7"
const { porIpPorDia, globalPorDia } = config.limites.demo

// Mesma conta de src/infra/auth/ip.ts (hashDoIp), refeita aqui porque R6 não deixa evals importarem infra.
function hashDoIp(ip: string, segredo: string): string {
  return createHmac("sha256", segredo).update(ip).digest("hex").slice(0, 32)
}

// Container em memória. O limitador e a transação são espiados: vemos as chaves usadas e se houve gravação.
function montar() {
  vi.stubEnv("RITU_MODO", "e2e")
  let agora = AGORA
  const clock = { now: () => agora }
  const stores = createMemoryStores(clock)
  const base = createMemoryLimiter()
  const chaves: string[] = []
  const limiter: UsageLimiter = {
    ...base,
    async consumir(pedidos, janela, inicio) {
      chaves.push(...pedidos.map((p) => p.chave))
      return base.consumir(pedidos, janela, inicio)
    },
  }
  const aberturas = { total: 0 }
  const tx: Transactor = {
    emTransacao<T>(fn: (s: Stores) => Promise<T>): Promise<T> {
      aberturas.total++
      return stores.emTransacao(fn)
    },
  }
  const container = createContainer({ clock, stores, tx, limiter })
  const depsDemo = () => ({
    tx,
    limiter,
    clock,
    kb: container.knowledge,
    seed: container.demoSeed,
    telemetry: container.telemetry,
  })
  return {
    container,
    stores,
    limiter,
    chaves,
    aberturas,
    clock,
    depsDemo,
    avancarHoras(horas: number) {
      agora = new Date(agora.getTime() + horas * HORA_MS)
    },
  }
}

async function codigoDe(promessa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promessa
    return undefined
  } catch (erro) {
    return erro instanceof LimiteDeDemonstracaoError ? erro.code : "outro_erro"
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("duas demonstrações não se enxergam", () => {
  it("dados gravados numa demonstração não aparecem para a outra", async () => {
    const m = montar()
    const dia = diaLocal(AGORA)
    const { stores } = m
    const a = await criarDemonstracao(m.depsDemo(), { ipHash: "a", semSeed: true })
    const b = await criarDemonstracao(m.depsDemo(), { ipHash: "b", semSeed: true })

    await stores.pantry.semear(a.id, [{ nome_livre: "leite", confirmado_em: AGORA }])
    await stores.messages.gravar(a.id, {
      autor: "pessoa",
      texto: "oi",
      com_incomodo: false,
      dia,
    })
    const run = await stores.runs.criar(a.id, { caminho: "alerta", intencoes: [], dia })
    await stores.outcomes.criar(a.id, run.id, [{ tipo: "cha", alimentos: [], titulo: "Chá" }])
    await stores.routine.anotar(a.id, "trabalho em turnos")
    await stores.patterns.propor(a.id, {
      tipo: "estados_juntos",
      chave: "a-b",
      frase: "frase",
      ocorrencias: 3,
    })

    // A própria conta enxerga o que gravou (sanidade do teste).
    expect(await stores.pantry.listar(a.id)).toHaveLength(1)
    expect(await stores.routine.notasAtivas(a.id)).toHaveLength(1)

    // A outra conta não enxerga nada disso.
    expect(await stores.pantry.listar(b.id)).toEqual([])
    expect(await stores.messages.doDia(b.id, dia)).toEqual([])
    expect(await stores.runs.recentes(b.id, new Date(0), 10)).toEqual([])
    expect(await stores.outcomes.pendentes(b.id)).toEqual([])
    expect(await stores.routine.notasAtivas(b.id)).toEqual([])
    expect(await stores.patterns.listar(b.id)).toEqual([])
  })
})

describe("limites de demonstração", () => {
  it("a 6ª demonstração do mesmo IP é recusada sem criar conta", async () => {
    const m = montar()
    const ipHash = hashDoIp(IP, SEGREDO)
    for (let i = 0; i < porIpPorDia; i++) {
      await criarDemonstracao(m.depsDemo(), { ipHash, semSeed: true })
    }
    const abertasAntes = m.aberturas.total

    expect(await codigoDe(criarDemonstracao(m.depsDemo(), { ipHash, semSeed: true }))).toBe(
      "demo_limite_ip",
    )
    expect(m.aberturas.total).toBe(abertasAntes)
  })

  it("a 31ª demonstração do dia é recusada sem criar conta, mesmo de IP novo", async () => {
    const m = montar()
    for (let i = 0; i < globalPorDia; i++) {
      await criarDemonstracao(m.depsDemo(), {
        ipHash: hashDoIp(`198.51.100.${i}`, SEGREDO),
        semSeed: true,
      })
    }
    const abertasAntes = m.aberturas.total

    const recusada = criarDemonstracao(m.depsDemo(), {
      ipHash: hashDoIp("192.0.2.1", SEGREDO),
      semSeed: true,
    })
    expect(await codigoDe(recusada)).toBe("demo_limite_global")
    expect(m.aberturas.total).toBe(abertasAntes)
  })

  it("nenhuma chave do limitador contém o IP em claro", async () => {
    const m = montar()
    const ipHash = hashDoIp(IP, SEGREDO)
    await criarDemonstracao(m.depsDemo(), { ipHash, semSeed: true })

    expect(m.chaves.length).toBeGreaterThan(0)
    for (const chave of m.chaves) {
      expect(chave).not.toContain(IP)
    }
    expect(m.chaves).toContain(`demo:ip:${ipHash}`)
    expect(await m.limiter.usado(`demo:ip:${ipHash}`, "dia", diaLocal(AGORA))).toBe(1)
  })
})

describe("demonstração vencida", () => {
  it("some em accounts.buscar e é apagada por executarLimpeza", async () => {
    const m = montar()
    const vencida = await criarDemonstracao(m.depsDemo(), { ipHash: "velha" })
    m.avancarHoras(25)
    const viva = await criarDemonstracao(m.depsDemo(), { ipHash: "nova" })

    expect(await m.stores.accounts.buscar(vencida.id)).toBeUndefined()
    expect(await m.stores.accounts.buscar(viva.id)).toBeDefined()

    const resultado = await executarLimpeza({
      stores: m.stores,
      clock: m.clock,
      ledger: createMemoryLedger(m.clock),
      limiter: m.limiter,
      bastidores: createMemoryBastidores(m.stores),
      telemetry: createMemoryTelemetry(),
    })
    expect(resultado.demos).toBe(1)
    expect(await m.stores.accounts.buscar(viva.id)).toBeDefined()
  })
})
