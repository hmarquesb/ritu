import { describe, expect, it } from "vitest"
import type { ModelRouter } from "@/core/llm/router"
import type { MensagemRecebida } from "@/core/messages/texto"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { chavesDeMensagem } from "./chaves"
import type { ContaDoLimite, DepsDosLimites, QuemPede } from "./estado"
import { type DecisaoDaMensagem, decidirMensagem } from "./mensagens"

const INICIO = "2026-01-15T15:00:00Z" // 12h em São Paulo
const FUSO = "America/Sao_Paulo"
const SEGUNDOS_ATE_MEIA_NOITE = 12 * 3600 // 12h até 24h

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
  // Só cotaDoDiaEsgotada é usado pela decisão; o resto do roteador não é chamado.
  const router = {
    cotaDoDiaEsgotada: async () => cotaEsgotada,
  } as unknown as ModelRouter
  const deps: DepsDosLimites = { limiter, router, clock, telemetry }
  return { clock, limiter, telemetry, deps }
}

const texto = (t: string): MensagemRecebida => ({ texto: t, atalhos: [] })
const CHA = texto("quero um chá")

function quem(extra: Partial<QuemPede> = {}): QuemPede {
  return { conta: conta(), ipHash: "ip1", fuso: FUSO, ...extra }
}

async function mandar(
  m: ReturnType<typeof montar>,
  q: QuemPede,
  msg = CHA,
): Promise<DecisaoDaMensagem> {
  return decidirMensagem(m.deps, q, msg)
}

describe("decidirMensagem", () => {
  it("31ª mensagem de conta Google é barrada com limite_mensagens e espera até a meia-noite", async () => {
    const m = montar()
    const q = quem()
    for (let i = 0; i < 30; i++) {
      expect(await mandar(m, q)).toEqual({ seguir: "normal" })
    }
    const r = await mandar(m, q)
    expect(r).toHaveProperty("barrar")
    if (!("barrar" in r)) return
    expect(r.barrar.code).toBe("limite_mensagens")
    expect(r.barrar.retryAfterS).toBe(SEGUNDOS_ATE_MEIA_NOITE)
    expect(m.telemetry.metricas.at(-1)).toMatchObject({
      nome: "ritu_limite_total",
      valor: 1,
      rotulos: { tipo: "mensagem", motivo: "conta", resultado: "barrado" },
    })
  })

  it("13ª mensagem da demonstração é barrada com limite_demo, também no dia seguinte", async () => {
    const m = montar()
    const q = quem({ conta: conta({ tipo: "demo", criado_em: "2026-01-15T12:00:00Z" }) })
    for (let i = 0; i < 12; i++) {
      expect(await mandar(m, q)).toEqual({ seguir: "normal" })
    }
    m.clock.set("2026-01-16T15:00:00Z")
    const r = await mandar(m, q)
    expect(r).toHaveProperty("barrar")
    if (!("barrar" in r)) return
    expect(r.barrar.code).toBe("limite_demo")
    expect(m.telemetry.metricas.at(-1)?.rotulos).toEqual({
      tipo: "mensagem",
      motivo: "demo",
      resultado: "barrado",
    })
  })

  it("a demonstração espera até conta.expira_em quando ele existe", async () => {
    const m = montar()
    const q = quem({
      conta: conta({
        tipo: "demo",
        criado_em: "2026-01-15T12:00:00Z",
        expira_em: "2026-01-16T15:00:00Z",
      }),
    })
    for (let i = 0; i < 12; i++) await mandar(m, q)
    const r = await mandar(m, q)
    expect(r).toHaveProperty("barrar")
    if (!("barrar" in r)) return
    expect(r.barrar.retryAfterS).toBe(86_400)
  })

  it("IP com 60 contas diferentes barra com limite_ip; a conta barrada não soma", async () => {
    const m = montar()
    for (let i = 0; i < 60; i++) {
      expect(await mandar(m, quem({ conta: conta({ id: `c${i}` }) }))).toEqual({
        seguir: "normal",
      })
    }
    const nova = quem({ conta: conta({ id: "nova" }) })
    const r = await mandar(m, nova)
    expect(r).toHaveProperty("barrar")
    if (!("barrar" in r)) return
    expect(r.barrar.code).toBe("limite_ip")
    const { conta: chaveConta, ip } = chavesDeMensagem(nova.conta, nova.ipHash, m.clock.now())
    expect(await m.limiter.usado(chaveConta.chave, "dia", chaveConta.inicio ?? "")).toBe(0)
    expect(await m.limiter.usado(ip.chave, "dia", ip.inicio ?? "")).toBe(60)
    expect(m.telemetry.metricas.at(-1)?.rotulos).toEqual({
      tipo: "mensagem",
      motivo: "ip",
      resultado: "barrado",
    })
  })

  it("conta barrada não soma no IP", async () => {
    const m = montar()
    const q = quem()
    for (let i = 0; i < 30; i++) await mandar(m, q)
    expect(await mandar(m, q)).toHaveProperty("barrar")
    const { ip } = chavesDeMensagem(q.conta, q.ipHash, m.clock.now())
    expect(await m.limiter.usado(ip.chave, "dia", ip.inicio ?? "")).toBe(30)
  })

  it("tester passa sem consumir e sem somar métrica", async () => {
    const m = montar()
    const q = quem({ conta: conta({ tester: true }), teto: 1 })
    for (let i = 0; i < 5; i++) {
      expect(await mandar(m, q)).toEqual({ seguir: "normal" })
    }
    const { conta: chaveConta, ip } = chavesDeMensagem(
      q.conta,
      q.ipHash,
      m.clock.now(),
      undefined,
      1,
    )
    expect(await m.limiter.usado(chaveConta.chave, "dia", chaveConta.inicio ?? "")).toBe(0)
    expect(await m.limiter.usado(ip.chave, "dia", ip.inicio ?? "")).toBe(0)
    expect(m.telemetry.metricas).toEqual([])
  })

  it("cota de IA do dia esgotada passa sem consumir e sem somar métrica", async () => {
    const m = montar(true)
    const q = quem()
    expect(await mandar(m, q)).toEqual({ seguir: "normal" })
    const { conta: chaveConta } = chavesDeMensagem(q.conta, q.ipHash, m.clock.now())
    expect(await m.limiter.usado(chaveConta.chave, "dia", chaveConta.inicio ?? "")).toBe(0)
    expect(m.telemetry.metricas).toEqual([])
  })

  it("só atalhos depois do limite passa como so_atalhos e soma a métrica", async () => {
    const m = montar()
    const q = quem()
    for (let i = 0; i < 30; i++) await mandar(m, q)
    expect(await mandar(m, q, { atalhos: ["sem_energia"] })).toEqual({
      seguir: "so_atalhos",
      motivo: "conta",
    })
    expect(m.telemetry.metricas.at(-1)?.rotulos).toEqual({
      tipo: "mensagem",
      motivo: "conta",
      resultado: "so_atalhos",
    })
  })

  it("dor no peito depois do limite segue como alerta (o guardrail responde)", async () => {
    const m = montar()
    const q = quem()
    for (let i = 0; i < 30; i++) await mandar(m, q)
    expect(await mandar(m, q, texto("tô com uma dor forte no peito"))).toEqual({
      seguir: "alerta",
      motivo: "conta",
    })
    expect(m.telemetry.metricas.at(-1)?.rotulos).toEqual({
      tipo: "mensagem",
      motivo: "conta",
      resultado: "alerta",
    })
  })

  it("sinal de sofrimento depois do limite segue como alerta", async () => {
    const m = montar()
    const q = quem()
    for (let i = 0; i < 30; i++) await mandar(m, q)
    expect(await mandar(m, q, texto("não aguento mais, queria sumir"))).toEqual({
      seguir: "alerta",
      motivo: "conta",
    })
  })

  it("pedido comum depois do limite é barrado", async () => {
    const m = montar()
    const q = quem()
    for (let i = 0; i < 30; i++) await mandar(m, q)
    expect(await mandar(m, q, CHA)).toHaveProperty("barrar")
  })
})
