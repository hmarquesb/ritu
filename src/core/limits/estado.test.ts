import { describe, expect, it } from "vitest"
import type { ModelRouter } from "@/core/llm/router"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import type { ContaDoLimite, DepsDosLimites, QuemPede } from "./estado"
import { estadoDosLimites } from "./estado"
import { decidirMensagem } from "./mensagens"

const INICIO = "2026-01-15T15:00:00Z" // 12h em São Paulo
const FUSO = "America/Sao_Paulo"

function conta(extra: Partial<ContaDoLimite> = {}): ContaDoLimite {
  return {
    id: "c1",
    tipo: "google",
    tester: false,
    criado_em: "2026-01-10T12:00:00Z",
    ...extra,
  }
}

function montar(cotaEsgotada = false) {
  const clock = createFixedClock(INICIO)
  const limiter = createMemoryLimiter()
  const telemetry = createMemoryTelemetry()
  // O estado só lê cotaDoDiaEsgotada: não chama modelo.
  const router = {
    cotaDoDiaEsgotada: async () => cotaEsgotada,
  } as unknown as ModelRouter
  const deps: DepsDosLimites = { limiter, router, clock, telemetry }
  return { deps }
}

function quem(extra: Partial<QuemPede> = {}): QuemPede {
  return { conta: conta(), ipHash: "ip1", fuso: FUSO, ...extra }
}

// Gasta `n` mensagens pelo caminho real (decidirMensagem), para o estado ler o que foi contado.
async function gastar(deps: DepsDosLimites, q: QuemPede, n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await decidirMensagem(deps, q, { texto: "quero um chá", atalhos: [] })
  }
}

describe("estadoDosLimites", () => {
  it("tester vê as mensagens como livres", async () => {
    const { deps } = montar()
    const estado = await estadoDosLimites(deps, quem({ conta: conta({ tester: true }) }))
    expect(estado.mensagens).toEqual({ tipo: "livre" })
    expect(estado.cota_ia).toEqual({ esgotada: false })
  })

  it("conta comum mostra os restantes pela menor folga entre conta e IP (IP mais apertado)", async () => {
    const { deps } = montar()
    // 55 contas diferentes deixam o IP com 5 de folga; a conta de teste ainda tem 30.
    for (let i = 0; i < 55; i++) {
      await gastar(deps, quem({ conta: conta({ id: `o${i}` }) }), 1)
    }
    const estado = await estadoDosLimites(deps, quem({ conta: conta({ id: "x" }) }))
    expect(estado.mensagens).toEqual({ tipo: "contando", restantes: 5, demo: false })
  })

  it("conta comum mostra os restantes pela menor folga entre conta e IP (conta mais apertada)", async () => {
    const { deps } = montar()
    const q = quem()
    await gastar(deps, q, 28)
    const estado = await estadoDosLimites(deps, q)
    expect(estado.mensagens).toEqual({ tipo: "contando", restantes: 2, demo: false })
  })

  it("demonstração aparece como contando com demo true", async () => {
    const { deps } = montar()
    const q = quem({ conta: conta({ tipo: "demo", criado_em: "2026-01-15T12:00:00Z" }) })
    await gastar(deps, q, 10)
    const estado = await estadoDosLimites(deps, q)
    expect(estado.mensagens).toEqual({ tipo: "contando", restantes: 2, demo: true })
  })

  it("conta esgotada aparece com motivo conta antes do IP quando os dois acabaram", async () => {
    const { deps } = montar()
    const q = quem()
    await gastar(deps, q, 30)
    for (let i = 0; i < 30; i++) {
      await gastar(deps, quem({ conta: conta({ id: `o${i}` }) }), 1)
    }
    const estado = await estadoDosLimites(deps, q)
    expect(estado.mensagens).toEqual({ tipo: "esgotadas", motivo: "conta" })
  })

  it("IP esgotado com a conta ainda com folga aparece como esgotadas com motivo ip", async () => {
    const { deps } = montar()
    for (let i = 0; i < 60; i++) {
      await gastar(deps, quem({ conta: conta({ id: `o${i}` }) }), 1)
    }
    const estado = await estadoDosLimites(deps, quem({ conta: conta({ id: "x" }) }))
    expect(estado.mensagens).toEqual({ tipo: "esgotadas", motivo: "ip" })
  })

  it("demonstração esgotada aparece com motivo demo", async () => {
    const { deps } = montar()
    const q = quem({ conta: conta({ tipo: "demo", criado_em: "2026-01-15T12:00:00Z" }) })
    await gastar(deps, q, 12)
    const estado = await estadoDosLimites(deps, q)
    expect(estado.mensagens).toEqual({ tipo: "esgotadas", motivo: "demo" })
  })

  it("cota de IA esgotada traz volta_as na hora local de São Paulo (virada à meia-noite de Los Angeles)", async () => {
    const { deps } = montar(true)
    const estado = await estadoDosLimites(deps, quem())
    expect(estado.cota_ia).toEqual({ esgotada: true, volta_as: "5h" })
  })
})
