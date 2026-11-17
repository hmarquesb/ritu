import { afterEach, describe, expect, it, vi } from "vitest"
import { copiarSeed } from "@/core/accounts/copiar-seed"
import type { EventoDaTela } from "@/core/conversation/eventos"
import { chavesDeMensagem } from "@/core/limits/chaves"
import { diaLocal } from "@/core/time/dia-local"
import { type Container, createContainer } from "@/infra/container"
import { rotasDeFluxoDeRun } from "./fluxo-de-run"

const PERGUNTA_DE_CASA = "fui à feira ontem, o que faço pro jantar?"

// O momento do dia muda os candidatos do agente (de manhã e ao almoço a couve não entra): o relógio fica fixo à noite
// (21h em São Paulo), que é onde o roteiro da pergunta de casa vale.
async function montar(agora = "2026-11-18T00:00:00Z") {
  vi.stubEnv("RITU_MODO", "e2e")
  const container = createContainer({ clock: { now: () => new Date(agora) } })
  const conta = await container.stores.accounts.criar({ tipo: "demo" })
  await copiarSeed(container.stores, conta.id, container.demoSeed, {
    clock: container.clock,
    kb: container.knowledge,
  })
  const outra = await container.stores.accounts.criar({ tipo: "demo" })
  const deps = (contaId?: string, teto?: number) => ({
    contaDaSessao: async () => contaId,
    container,
    quemPede: () => ({ ipHash: "h", ...(teto ? { teto } : {}) }),
  })
  return { container, conta, outra, deps }
}

const pedido = (corpo: unknown) =>
  new Request("http://x/api/runs", { method: "POST", body: JSON.stringify(corpo) })

const noRun = (id: string) => ({ params: Promise.resolve({ id }) })

async function eventos(r: Response): Promise<EventoDaTela[]> {
  return (await r.text())
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
}

const texto = (t: string) => ({ texto: t, atalhos: [] })

async function ate(container: Container, contaId: string, runId: string, status: string) {
  for (let i = 0; i < 100; i++) {
    if ((await container.stores.runs.buscar(contaId, runId))?.status === status) return true
    await new Promise((r) => setTimeout(r, 20))
  }
  return false
}

describe("rotasDeFluxoDeRun", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("POST /api/runs: inicio, etapas sem repetir e fim com a visão", async () => {
    const m = await montar()
    const { iniciar } = rotasDeFluxoDeRun(m.deps(m.conta.id))
    const r = await iniciar(pedido(texto(m.container.demoSeed.mensagem_sugerida)))
    expect(r.status).toBe(200)
    expect(r.headers.get("content-type")).toContain("application/x-ndjson")

    const ev = await eventos(r)
    expect(ev[0]?.tipo).toBe("inicio")
    expect(ev.at(-1)?.tipo).toBe("fim")
    const etapas = ev.flatMap((e) => (e.tipo === "etapa" ? [e.frase.chave] : []))
    expect(etapas.length).toBeGreaterThan(0)
    etapas.forEach((c, i) => {
      expect(c).not.toBe(etapas[i - 1])
    })
    const fim = ev.at(-1)
    if (fim?.tipo !== "fim") throw new Error("sem fim")
    const inicio = ev[0]
    expect(fim.visao.run_id).toBe(inicio?.tipo === "inicio" ? inicio.run_id : "")
    expect(fim.visao.status).toBe("waiting_for_approval")
    expect(fim.pendentes).toBeGreaterThanOrEqual(0)
    expect(Object.keys(fim.visao)).not.toContain("saida")
  })

  it("sem sessão é 401", async () => {
    const m = await montar()
    const { iniciar, responder } = rotasDeFluxoDeRun(m.deps(undefined))
    expect((await iniciar(pedido(texto("oi")))).status).toBe(401)
    const r = await responder(pedido({ tipo: "pular" }), noRun(crypto.randomUUID()))
    expect(r.status).toBe(401)
  })

  it("run aberto é 409 run_aberto em JSON", async () => {
    const m = await montar()
    await m.container.stores.runs.criar(m.conta.id, {
      caminho: "acompanhante",
      intencoes: [],
      dia: "2026-03-10",
    })
    const { iniciar } = rotasDeFluxoDeRun(m.deps(m.conta.id))
    const r = await iniciar(pedido(texto(PERGUNTA_DE_CASA)))
    expect(r.status).toBe(409)
    expect(await r.json()).toEqual({ erro: "run_aberto" })
  })

  it("dois POST concorrentes: o segundo é 409 run_aberto e o primeiro termina sem perder o run", async () => {
    const m = await montar()
    const { iniciar } = rotasDeFluxoDeRun(m.deps(m.conta.id))
    const primeiro = await iniciar(pedido(texto("demora um pouco")))
    const leitor = primeiro.body?.getReader()
    let visto = ""
    while (!visto.includes('"tipo":"etapa"')) {
      const parte = await leitor?.read()
      if (!parte || parte.done) break
      visto += new TextDecoder().decode(parte.value)
    }
    const segundo = await iniciar(pedido(texto("oi de novo")))
    expect(segundo.status).toBe(409)
    expect(await segundo.json()).toEqual({ erro: "run_aberto" })
    const resto: string[] = [visto]
    for (;;) {
      const parte = await leitor?.read()
      if (!parte || parte.done) break
      resto.push(new TextDecoder().decode(parte.value))
    }
    const ev = resto
      .join("")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as EventoDaTela)
    expect(ev.at(-1)?.tipo).toBe("fim")
  })

  it("/resposta com run de outra conta é 404", async () => {
    const m = await montar()
    const run = await m.container.stores.runs.criar(m.outra.id, {
      caminho: "acompanhante",
      intencoes: [],
      dia: "2026-03-10",
    })
    const { responder } = rotasDeFluxoDeRun(m.deps(m.conta.id))
    const r = await responder(pedido({ tipo: "pular" }), noRun(run.id))
    expect(r.status).toBe(404)
    expect(await r.json()).toEqual({ erro: "run_nao_encontrado" })
  })

  it.each([
    "2026-11-17T06:00:00Z",
    "2026-11-18T01:00:00Z",
    "2026-11-18T00:00:00Z",
    "2026-11-18T02:30:00Z",
  ])("/resposta numa pergunta de casa segue até o fim (%s)", async (agora) => {
    const m = await montar(agora)
    const { iniciar, responder } = rotasDeFluxoDeRun(m.deps(m.conta.id))
    const primeiro = await eventos(await iniciar(pedido(texto(PERGUNTA_DE_CASA))))
    const fim1 = primeiro.at(-1)
    if (fim1?.tipo !== "fim") throw new Error("sem fim")
    expect(fim1.visao.status).toBe("waiting_for_input")
    const pergunta = fim1.visao.pergunta?.pergunta
    if (pergunta?.tipo !== "casa") throw new Error("sem pergunta de casa")

    const r = await responder(
      pedido({
        tipo: "casa",
        itens: pergunta.itens.map((i) => ({ alimento_id: i.alimento_id, resposta: "tenho" })),
      }),
      noRun(fim1.visao.run_id),
    )
    expect(r.status).toBe(200)
    const ev = await eventos(r)
    expect(ev[0]).toEqual({ tipo: "inicio", run_id: fim1.visao.run_id })
    const fim = ev.at(-1)
    if (fim?.tipo !== "fim") throw new Error("sem fim")
    expect(["done", "waiting_for_approval"]).toContain(fim.visao.status)
  })

  it("/resposta sem pergunta aberta é 409 em JSON, antes de qualquer evento", async () => {
    const m = await montar()
    const { iniciar, responder } = rotasDeFluxoDeRun(m.deps(m.conta.id))
    const ev = await eventos(await iniciar(pedido(texto(m.container.demoSeed.mensagem_sugerida))))
    const runId = ev[0]?.tipo === "inicio" ? ev[0].run_id : ""
    const r = await responder(pedido({ tipo: "pular" }), noRun(runId))
    expect(r.status).toBe(409)
    expect(await r.json()).toEqual({ erro: "run_nao_continuavel" })
  })

  it("se a pessoa cancela o fluxo, o run termina no store", async () => {
    const m = await montar()
    const { iniciar } = rotasDeFluxoDeRun(m.deps(m.conta.id))
    const r = await iniciar(pedido(texto(m.container.demoSeed.mensagem_sugerida)))
    const leitor = r.body?.getReader()
    const primeira = await leitor?.read()
    const linha = new TextDecoder().decode(primeira?.value).split("\n")[0] ?? ""
    const inicio = JSON.parse(linha) as EventoDaTela
    await leitor?.cancel()
    if (inicio.tipo !== "inicio") throw new Error("sem inicio")
    expect(await ate(m.container, m.conta.id, inicio.run_id, "waiting_for_approval")).toBe(true)
  })

  describe("limite de mensagens", () => {
    async function gastarAteOLimite(m: Awaited<ReturnType<typeof montar>>, teto: number) {
      const { iniciar } = rotasDeFluxoDeRun(m.deps(m.conta.id, teto))
      for (let i = 0; i < teto; i++) {
        const ev = await eventos(await iniciar(pedido(texto("quero um chá"))))
        const runId = ev[0]?.tipo === "inicio" ? ev[0].run_id : ""
        await m.container.stores.runs.atualizar(m.conta.id, runId, { status: "done" })
      }
      return iniciar
    }

    it("depois do teto: 429 com limites e Retry-After, sem run nem mensagem gravados", async () => {
      const m = await montar()
      const iniciar = await gastarAteOLimite(m, 2)
      const dia = diaLocal(m.container.clock.now(), m.container.config.clima.fusoPadrao)
      const msgsAntes = (await m.container.stores.messages.doDia(m.conta.id, dia)).length
      const runsAntes = (await m.container.stores.runs.doDia(m.conta.id, dia)).length
      expect(msgsAntes).toBeGreaterThan(0)
      const r = await iniciar(pedido(texto("outro chá, por favor")))
      expect(r.status).toBe(429)
      expect(Number(r.headers.get("Retry-After"))).toBeGreaterThan(0)
      const corpo = (await r.json()) as { erro: string; limites: { mensagens: { tipo: string } } }
      expect(corpo.erro).toMatch(/^limite_/)
      expect(corpo.limites.mensagens.tipo).toBe("esgotadas")
      expect((await m.container.stores.messages.doDia(m.conta.id, dia)).length).toBe(msgsAntes)
      expect((await m.container.stores.runs.doDia(m.conta.id, dia)).length).toBe(runsAntes)
      expect(await m.container.stores.runs.aberto(m.conta.id)).toBeUndefined()
    })

    it("só atalhos depois do limite seguem sem modelo", async () => {
      const m = await montar()
      const iniciar = await gastarAteOLimite(m, 1)
      const ev = await eventos(await iniciar(pedido({ atalhos: ["pesada"] })))
      const fim = ev.at(-1)
      if (fim?.tipo !== "fim") throw new Error("sem fim")
      expect(fim.visao.caminho).toBe("sem_modelo")
    })

    it("alerta depois do limite recebe o texto de alerta", async () => {
      const m = await montar()
      const iniciar = await gastarAteOLimite(m, 1)
      const r = await iniciar(pedido(texto("estou com dor no peito")))
      expect(r.status).toBe(200)
      const fim = (await eventos(r)).at(-1)
      if (fim?.tipo !== "fim") throw new Error("sem fim")
      expect(fim.visao.caminho).toBe("alerta")
      expect(fim.visao.resposta).toBeTruthy()
    })

    it("run aberto é 409 e a contagem não sobe", async () => {
      const m = await montar()
      await m.container.stores.runs.criar(m.conta.id, {
        caminho: "acompanhante",
        intencoes: [],
        dia: "2026-03-10",
      })
      const { iniciar } = rotasDeFluxoDeRun(m.deps(m.conta.id, 1))
      expect((await iniciar(pedido(texto("oi")))).status).toBe(409)
      const estado = await m.container.stores.runs.aberto(m.conta.id)
      if (estado) await m.container.stores.runs.atualizar(m.conta.id, estado.id, { status: "done" })
      const ev = await eventos(await iniciar(pedido(texto("quero um chá"))))
      expect(ev.at(-1)?.tipo).toBe("fim")
    })

    it("corpo inválido é 400 e não consome", async () => {
      const m = await montar()
      const { iniciar } = rotasDeFluxoDeRun(m.deps(m.conta.id, 1))
      expect((await iniciar(pedido({ nada: 1 }))).status).toBe(400)
      const ev = await eventos(await iniciar(pedido(texto("quero um chá"))))
      expect(ev.at(-1)?.tipo).toBe("fim")
    })

    it("cota do dia esgotada: a mensagem passa e não consome", async () => {
      const m = await montar()
      const router = { ...m.container.router, cotaDoDiaEsgotada: async () => true }
      const container = { ...m.container, router } as Container
      const { iniciar } = rotasDeFluxoDeRun({
        contaDaSessao: async () => m.conta.id,
        container,
        quemPede: () => ({ ipHash: "h", teto: 1 }),
      })
      for (let i = 0; i < 2; i++) {
        const r = await iniciar(pedido(texto("quero um chá")))
        expect(r.status).toBe(200)
        const ev = await eventos(r)
        const runId = ev[0]?.tipo === "inicio" ? ev[0].run_id : ""
        await m.container.stores.runs.atualizar(m.conta.id, runId, { status: "done" })
      }
      const { conta: chave } = chavesDeMensagem(m.conta, "h", m.container.clock.now(), undefined, 1)
      expect(await m.container.limiter.usado(chave.chave, "dia", chave.inicio ?? "")).toBe(0)
    })

    it("o fim leva os limites com as restantes atualizadas", async () => {
      const m = await montar()
      const { iniciar } = rotasDeFluxoDeRun(m.deps(m.conta.id, 5))
      const fim = (await eventos(await iniciar(pedido(texto("quero um chá"))))).at(-1)
      if (fim?.tipo !== "fim") throw new Error("sem fim")
      expect(fim.limites.mensagens).toMatchObject({ tipo: "contando", restantes: 4 })
    })
  })
})
