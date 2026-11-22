import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { config } from "@config/index"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { DepsDaRota } from "@/app/_lib/rota"
import { rotasDeBusca } from "@/app/_rotas/busca"
import { rotasDaCasa } from "@/app/_rotas/casa"
import { rotasDaConversa } from "@/app/_rotas/conversa"
import { rotasDeFluxoDeRun } from "@/app/_rotas/fluxo-de-run"
import { rotasDeOnboarding } from "@/app/_rotas/onboarding"
import { rotasDoVoce } from "@/app/_rotas/voce"
import { copiarSeed } from "@/core/accounts/copiar-seed"
import { entrarComGoogle } from "@/core/accounts/entrar"
import type { Conta } from "@/core/accounts/types"
import type { EventoDaTela } from "@/core/conversation/eventos"
import { chavesDeMensagem, chavesDeToque } from "@/core/limits/chaves"
import { type EstadoDosLimites, estadoDosLimites } from "@/core/limits/estado"
import { decidirMensagem } from "@/core/limits/mensagens"
import { consumirToque } from "@/core/limits/toques"
import { diaLocal } from "@/core/time/dia-local"
import { type Container, createContainer } from "@/infra/container"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"

// Limites de mensagem, de toque e de demonstração, com o relógio e os contadores em memória.
// Cada número é conferido no próprio contador (`limiter.usado`) e no que a rota grava (runs, mensagens, votos).

const AGORA = "2026-03-10T15:00:00.000Z" // 12h em São Paulo
const HORA_EM_MS = 3_600_000
const IP = "ip-limites"
const FUSO = config.clima.fusoPadrao
const MENSAGEM = { texto: "quero um chá", atalhos: [] }
const RUN_FIXO = "00000000-0000-4000-8000-0000000000aa"
const EMAIL_TESTER = "tester@limites.test"
const RAIZ = fileURLToPath(new URL("../../../", import.meta.url))

type Quem = { teto?: number; ipHash?: string }

type Montagem = {
  container: Container
  stores: ReturnType<typeof createMemoryStores>
  clock: ReturnType<typeof createFixedClock>
  telemetry: ReturnType<typeof createMemoryTelemetry>
  limiter: ReturnType<typeof createMemoryLimiter>
  deps: (contaId?: string, quem?: Quem) => DepsDaRota
}

// Container em memória, como o de conversa.eval. `cotaEsgotada` põe o roteador com a cota de IA do dia esgotada.
function montar(opts: { cotaEsgotada?: boolean } = {}): Montagem {
  vi.stubEnv("RITU_MODO", "e2e")
  const clock = createFixedClock(AGORA)
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const limiter = createMemoryLimiter()
  const base = { clock, stores, tx: stores, limiter, telemetry }
  const normal = createContainer(base)
  const container = opts.cotaEsgotada
    ? createContainer({
        ...base,
        router: { ...normal.router, cotaDoDiaEsgotada: async () => true },
      })
    : normal
  const deps = (contaId?: string, quem: Quem = {}): DepsDaRota => ({
    contaDaSessao: async () => contaId,
    quemPede: () => ({
      ipHash: quem.ipHash ?? IP,
      ...(quem.teto !== undefined ? { teto: quem.teto } : {}),
    }),
    container,
  })
  return { container, stores, clock, telemetry, limiter, deps }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const pedido = (corpo?: unknown, url = "http://x/api/runs") =>
  new Request(url, {
    method: "POST",
    ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
  })

async function eventos(r: Response): Promise<EventoDaTela[]> {
  return (await r.text())
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as EventoDaTela)
}

async function barrada(r: Response) {
  const corpo = (await r.json()) as { erro: string; limites?: EstadoDosLimites }
  return { status: r.status, retry: Number(r.headers.get("Retry-After")), corpo }
}

const diaDoRelogio = (m: Montagem) => diaLocal(m.clock.now())

// O que a rota grava no dia do relógio: runs e mensagens da conta.
async function gravado(m: Montagem, contaId: string) {
  const dia = diaDoRelogio(m)
  return {
    runs: (await m.stores.runs.doDia(contaId, dia)).length,
    mensagens: (await m.stores.messages.doDia(contaId, dia)).length,
  }
}

async function contaGoogle(m: Montagem, nome: string): Promise<Conta> {
  return m.stores.accounts.criar({
    tipo: "google",
    google_sub: `sub-${nome}`,
    email: `${nome}@limites.test`,
  })
}

// Decisão da mensagem como a rota a toma, sem conversa: enche o contador pelo mesmo caminho.
function decidir(m: Montagem, conta: Conta, ipHash = IP) {
  return decidirMensagem(
    { limiter: m.limiter, router: m.container.router, clock: m.clock, telemetry: m.telemetry },
    { conta, fuso: FUSO, ipHash },
    MENSAGEM,
  )
}

async function usoDaMensagem(m: Montagem, conta: Conta, ipHash = IP) {
  const { conta: c, ip } = chavesDeMensagem(conta, ipHash, m.clock.now())
  return {
    conta: await m.limiter.usado(c.chave, "dia", c.inicio ?? ""),
    ip: await m.limiter.usado(ip.chave, "dia", ip.inicio ?? ""),
  }
}

async function usoDoToque(m: Montagem, conta: Conta, ipHash = IP) {
  const { minuto, dia, ip } = chavesDeToque(conta, ipHash, m.clock.now())
  return {
    minuto: await m.limiter.usado(minuto.chave, "minuto", minuto.inicio ?? ""),
    dia: await m.limiter.usado(dia.chave, "dia", dia.inicio ?? ""),
    ip: await m.limiter.usado(ip.chave, "dia", ip.inicio ?? ""),
  }
}

// Uma mensagem real pela rota, com a conversa até o fim; o run vai para `done` para liberar a próxima.
async function mandarPassando(m: Montagem, contaId: string, texto = "quero um chá") {
  const r = await rotasDeFluxoDeRun(m.deps(contaId)).iniciar(pedido({ texto, atalhos: [] }))
  const ev = await eventos(r)
  const inicio = ev[0]
  if (r.status !== 200 || inicio?.tipo !== "inicio") {
    throw new Error(`mensagem não passou: ${r.status}`)
  }
  await m.stores.runs.atualizar(contaId, inicio.run_id, { status: "done" })
}

async function mandarBarrada(m: Montagem, contaId: string, quem?: Quem) {
  const r = await rotasDeFluxoDeRun(m.deps(contaId, quem)).iniciar(
    pedido({ texto: "mais uma", atalhos: [] }),
  )
  return barrada(r)
}

// Voto ou aprovação: a rota de run, com o run no caminho.
async function tocarVoto(m: Montagem, contaId: string, runId: string, quem?: Quem) {
  return rotasDaConversa(m.deps(contaId, quem)).voto(
    pedido({ voto: "up" }, `http://x/api/runs/${runId}/voto`),
    { params: Promise.resolve({ id: runId }) },
  )
}

// Conta com um run já concluído, para os toques de run.
async function contaComRun(m: Montagem, nome: string) {
  const conta = await contaGoogle(m, nome)
  const run = await m.stores.runs.criar(conta.id, {
    caminho: "acompanhante",
    intencoes: [],
    dia: diaDoRelogio(m),
  })
  // Com saída: o voto só vale para run que já respondeu.
  await m.stores.runs.atualizar(conta.id, run.id, {
    status: "done",
    saida: { resposta: "Um chá morno, por favor." },
  })
  return { conta, run }
}

const estadoDe = (m: Montagem, conta: Conta, ipHash = IP): Promise<EstadoDosLimites> =>
  estadoDosLimites(
    { limiter: m.limiter, router: m.container.router, clock: m.clock, telemetry: m.telemetry },
    { conta, fuso: FUSO, ipHash },
  )

describe("limite de mensagens da conta Google", () => {
  it("30 mensagens passam; a 31ª é 429 limite_mensagens, sem run nem mensagem gravados", async () => {
    const m = montar()
    const conta = await contaGoogle(m, "trinta")
    for (let i = 0; i < 30; i++) await mandarPassando(m, conta.id)

    const antes = await gravado(m, conta.id)
    expect(antes.runs).toBe(30)
    expect(antes.mensagens).toBeGreaterThan(0)
    expect(await usoDaMensagem(m, conta)).toEqual({ conta: 30, ip: 30 })

    const b = await mandarBarrada(m, conta.id)
    expect(b.status).toBe(429)
    expect(b.corpo.erro).toBe("limite_mensagens")
    expect(b.corpo.limites?.mensagens).toMatchObject({ tipo: "esgotadas", motivo: "conta" })
    expect(b.retry).toBeGreaterThanOrEqual(1)

    expect(await gravado(m, conta.id)).toEqual(antes)
    expect(await m.stores.runs.aberto(conta.id)).toBeUndefined()
  })

  it("o estado da tela conta as restantes e vira esgotado depois da 30ª", async () => {
    const m = montar()
    const conta = await contaGoogle(m, "restantes")
    for (let i = 0; i < 29; i++) await mandarPassando(m, conta.id)
    expect(await estadoDe(m, conta)).toMatchObject({
      mensagens: { tipo: "contando", restantes: 1, demo: false },
    })
    await mandarPassando(m, conta.id)
    expect((await estadoDe(m, conta)).mensagens).toEqual({ tipo: "esgotadas", motivo: "conta" })
  })
})

describe("limite da demonstração", () => {
  it("13ª mensagem é limite_demo; no dia seguinte segue barrada, com espera até a expiração", async () => {
    const m = montar()
    const demo = await m.stores.accounts.criar({
      tipo: "demo",
      expira_em: new Date(Date.parse(AGORA) + 24 * HORA_EM_MS),
    })
    await copiarSeed(m.stores, demo.id, m.container.demoSeed, {
      clock: m.clock,
      kb: m.container.knowledge,
    })
    for (let i = 0; i < 12; i++) await mandarPassando(m, demo.id)
    const diaDaCriacao = diaLocal(new Date(AGORA))
    expect((await m.stores.runs.doDia(demo.id, diaDaCriacao)).length).toBe(12)

    const primeira = await mandarBarrada(m, demo.id)
    expect(primeira.status).toBe(429)
    expect(primeira.corpo.erro).toBe("limite_demo")
    expect(primeira.corpo.limites?.mensagens).toMatchObject({ tipo: "esgotadas", motivo: "demo" })
    expect(primeira.retry).toBe(86_400)

    // Dia seguinte, ainda antes da expiração: o limite da demonstração não zera com o dia.
    m.clock.set("2026-03-11T12:00:00.000Z")
    expect(diaDoRelogio(m)).not.toBe(diaDaCriacao)
    const seguinte = await mandarBarrada(m, demo.id)
    expect(seguinte.status).toBe(429)
    expect(seguinte.corpo.erro).toBe("limite_demo")
    expect(seguinte.retry).toBe(10_800)
    expect(await gravado(m, demo.id)).toEqual({ runs: 0, mensagens: 0 })
    expect((await m.stores.runs.doDia(demo.id, diaDaCriacao)).length).toBe(12)
  })
})

describe("limite do IP e atomicidade", () => {
  it("61ª mensagem do IP, com contas diferentes, é limite_ip; a conta nova não soma", async () => {
    const m = montar()
    for (let i = 0; i < 60; i++) {
      const c = await contaGoogle(m, `ip-${i}`)
      expect(await decidir(m, c)).toEqual({ seguir: "normal" })
    }
    expect((await usoDaMensagem(m, await contaGoogle(m, "ip-ref"))).ip).toBe(60)

    const nova = await contaGoogle(m, "ip-61")
    const b = await mandarBarrada(m, nova.id)
    expect(b.status).toBe(429)
    expect(b.corpo.erro).toBe("limite_ip")
    expect(b.corpo.limites?.mensagens).toMatchObject({ tipo: "esgotadas", motivo: "ip" })
    expect(await usoDaMensagem(m, nova)).toEqual({ conta: 0, ip: 60 })
    expect(await gravado(m, nova.id)).toEqual({ runs: 0, mensagens: 0 })
  })

  it("conta cheia barrada não soma no IP", async () => {
    const m = montar()
    const conta = await contaGoogle(m, "cheia")
    for (let i = 0; i < 30; i++) expect(await decidir(m, conta)).toEqual({ seguir: "normal" })
    expect(await usoDaMensagem(m, conta)).toEqual({ conta: 30, ip: 30 })

    const b = await mandarBarrada(m, conta.id)
    expect(b.corpo.erro).toBe("limite_mensagens")
    expect(await usoDaMensagem(m, conta)).toEqual({ conta: 30, ip: 30 })
  })
})

describe("run aberto e cota de IA", () => {
  it("run em running: 409 run_aberto e nenhuma mensagem consumida", async () => {
    const m = montar()
    const conta = await contaGoogle(m, "aberto")
    await m.stores.runs.criar(conta.id, {
      caminho: "acompanhante",
      intencoes: [],
      dia: diaDoRelogio(m),
    })
    expect(await m.stores.runs.aberto(conta.id)).toBeDefined()

    const antes = await usoDaMensagem(m, conta)
    const r = await rotasDeFluxoDeRun(m.deps(conta.id)).iniciar(
      pedido({ texto: "oi", atalhos: [] }),
    )
    expect(r.status).toBe(409)
    expect(await r.json()).toEqual({ erro: "run_aberto" })
    expect(await usoDaMensagem(m, conta)).toEqual(antes)
  })

  it("cota de IA do dia esgotada: a mensagem passa e não consome", async () => {
    const m = montar({ cotaEsgotada: true })
    const conta = await contaGoogle(m, "cota")
    const { iniciar } = rotasDeFluxoDeRun(m.deps(conta.id))
    for (let i = 0; i < 2; i++) {
      const r = await iniciar(pedido(MENSAGEM))
      expect(r.status).toBe(200)
      const ev = await eventos(r)
      const inicio = ev[0]
      if (inicio?.tipo !== "inicio") throw new Error("sem inicio")
      await m.stores.runs.atualizar(conta.id, inicio.run_id, { status: "done" })
    }
    expect((await gravado(m, conta.id)).runs).toBe(2)
    expect(await usoDaMensagem(m, conta)).toEqual({ conta: 0, ip: 0 })
  })
})

describe("tester", () => {
  it("tester não tem limite nem contagem; a passagem pela rota grava o run", async () => {
    const m = montar()
    const t = await entrarComGoogle(
      { stores: m.stores, telemetry: m.telemetry, testers: [EMAIL_TESTER] },
      { sub: "tester-1", email: EMAIL_TESTER },
    )
    expect(t.tester).toBe(true)
    for (let i = 0; i < 31; i++) expect(await decidir(m, t)).toEqual({ seguir: "normal" })
    expect(await usoDaMensagem(m, t)).toEqual({ conta: 0, ip: 0 })
    expect((await estadoDe(m, t)).mensagens).toEqual({ tipo: "livre" })

    await mandarPassando(m, t.id)
    expect((await gravado(m, t.id)).runs).toBe(1)
    expect(await usoDaMensagem(m, t)).toEqual({ conta: 0, ip: 0 })
  })

  it("tester tirado da lista na entrada seguinte volta a contar", async () => {
    const m = montar()
    const primeira = await entrarComGoogle(
      { stores: m.stores, telemetry: m.telemetry, testers: [EMAIL_TESTER] },
      { sub: "tester-2", email: EMAIL_TESTER },
    )
    expect(primeira.tester).toBe(true)
    const depois = await entrarComGoogle(
      { stores: m.stores, telemetry: m.telemetry, testers: [] },
      { sub: "tester-2", email: EMAIL_TESTER },
    )
    expect(depois.tester).toBe(false)

    for (let i = 0; i < 30; i++) expect(await decidir(m, depois)).toEqual({ seguir: "normal" })
    expect(await usoDaMensagem(m, depois)).toEqual({ conta: 30, ip: 30 })
    const b = await mandarBarrada(m, depois.id)
    expect(b.corpo.erro).toBe("limite_mensagens")
    expect(await usoDaMensagem(m, depois)).toEqual({ conta: 30, ip: 30 })
  })
})

describe("limites dos toques", () => {
  it("61º toque do minuto: 429 limite_toques com espera de até um minuto; o voto não muda", async () => {
    const m = montar()
    const { conta, run } = await contaComRun(m, "minuto")
    const ok = await tocarVoto(m, conta.id, run.id)
    expect(ok.status).toBe(200)
    expect(await m.stores.runs.votos(conta.id, [run.id])).toEqual({ [run.id]: "up" })

    for (let i = 0; i < 59; i++) {
      const c = await consumirToque(
        { limiter: m.limiter, router: m.container.router, clock: m.clock, telemetry: m.telemetry },
        { conta, ipHash: IP, fuso: FUSO },
      )
      expect(c.ok).toBe(true)
    }
    expect((await usoDoToque(m, conta)).minuto).toBe(60)

    const b = await barrada(await tocarVoto(m, conta.id, run.id))
    expect(b.status).toBe(429)
    expect(b.corpo.erro).toBe("limite_toques")
    expect(b.retry).toBeGreaterThanOrEqual(1)
    expect(b.retry).toBeLessThanOrEqual(60)
    expect(await m.stores.runs.votos(conta.id, [run.id])).toEqual({ [run.id]: "up" })
  })

  it("301º toque do dia: 429 limite_toques com espera até a meia-noite", async () => {
    const m = montar()
    const { conta, run } = await contaComRun(m, "dia")
    expect((await tocarVoto(m, conta.id, run.id)).status).toBe(200)

    // Um minuto por toque: o contador do minuto nunca barra, só o do dia.
    for (let i = 0; i < 299; i++) {
      m.clock.advance(61_000)
      const c = await consumirToque(
        { limiter: m.limiter, router: m.container.router, clock: m.clock, telemetry: m.telemetry },
        { conta, ipHash: IP, fuso: FUSO },
      )
      expect(c.ok).toBe(true)
    }
    expect((await usoDoToque(m, conta)).dia).toBe(300)

    m.clock.advance(61_000)
    const b = await barrada(await tocarVoto(m, conta.id, run.id))
    expect(b.status).toBe(429)
    expect(b.corpo.erro).toBe("limite_toques")
    expect(b.retry).toBeGreaterThan(60)
    expect(b.retry).toBeLessThanOrEqual(86_400)
    expect(await m.stores.runs.votos(conta.id, [run.id])).toEqual({ [run.id]: "up" })
    expect((await usoDoToque(m, conta)).dia).toBe(300)
  })

  it("aprovação barrada pelo toque: 429 e a aprovação não roda", async () => {
    const m = montar()
    const { conta, run } = await contaComRun(m, "aprovacao")
    const aprovar = vi.spyOn(m.container.conversation, "aprovar")
    const cheio = {
      limiter: m.limiter,
      router: m.container.router,
      clock: m.clock,
      telemetry: m.telemetry,
    }
    for (let i = 0; i < 60; i++) {
      await consumirToque(cheio, { conta, ipHash: IP, fuso: FUSO })
    }
    const r = await rotasDaConversa(m.deps(conta.id)).aprovacao(
      pedido({ aprovadas: [] }, `http://x/api/runs/${run.id}/aprovacao`),
      { params: Promise.resolve({ id: run.id }) },
    )
    const b = await barrada(r)
    expect(b.status).toBe(429)
    expect(b.corpo.erro).toBe("limite_toques")
    expect(aprovar).not.toHaveBeenCalled()
  })

  it("toques por IP com teto reduzido: a terceira conta do mesmo IP recebe 429 e não soma", async () => {
    const m = montar()
    const quem = { teto: 2, ipHash: "ip-reduzido" }
    const c1 = await contaComRun(m, "ip-a")
    const c2 = await contaComRun(m, "ip-b")
    const c3 = await contaComRun(m, "ip-c")

    expect((await tocarVoto(m, c1.conta.id, c1.run.id, quem)).status).toBe(200)
    expect((await tocarVoto(m, c2.conta.id, c2.run.id, quem)).status).toBe(200)
    expect((await usoDoToque(m, c1.conta, "ip-reduzido")).ip).toBe(2)

    const b = await barrada(await tocarVoto(m, c3.conta.id, c3.run.id, quem))
    expect(b.status).toBe(429)
    expect(b.corpo.erro).toBe("limite_toques")
    expect(await m.stores.runs.votos(c3.conta.id, [c3.run.id])).toEqual({})
    // O contador do minuto sobe antes do barramento do dia (como em `consumirToque`); o do dia e o do IP não sobem.
    expect(await usoDoToque(m, c3.conta, "ip-reduzido")).toMatchObject({ dia: 0, ip: 2 })
  })

  it("controle: sem teto reduzido, a mesma terceira conta vota", async () => {
    const m = montar()
    const c3 = await contaComRun(m, "controle-ip")
    const r = await tocarVoto(m, c3.conta.id, c3.run.id, { ipHash: "ip-livre" })
    expect(r.status).toBe(200)
    expect(await m.stores.runs.votos(c3.conta.id, [c3.run.id])).toEqual({ [c3.run.id]: "up" })
  })
})

describe("POST /api/runs barrado", () => {
  it("teto zero: 429 com erro e o estado dos limites no corpo", async () => {
    const m = montar()
    const conta = await contaGoogle(m, "teto-zero")
    const b = await barrada(
      await rotasDeFluxoDeRun(m.deps(conta.id, { teto: 0 })).iniciar(pedido(MENSAGEM)),
    )
    expect(b.status).toBe(429)
    expect(b.corpo.erro).toBe("limite_mensagens")
    expect(b.corpo.limites).toBeDefined()
    expect(b.retry).toBeGreaterThanOrEqual(1)
    expect(await gravado(m, conta.id)).toEqual({ runs: 0, mensagens: 0 })
  })
})

describe("GET não consome", () => {
  it("conversa e run seguem 200 com o teto zerado, e nenhum toque sobe", async () => {
    const m = montar()
    const { conta, run } = await contaComRun(m, "leitura")
    expect((await tocarVoto(m, conta.id, run.id)).status).toBe(200)
    const antes = await usoDoToque(m, conta)
    expect(antes.dia).toBe(1)

    const rotas = rotasDaConversa(m.deps(conta.id, { teto: 0 }))
    const conversa = await rotas.conversa(new Request("http://x/api/conversa"))
    expect(conversa.status).toBe(200)
    const lido = await rotas.run(new Request(`http://x/api/runs/${run.id}`), {
      params: Promise.resolve({ id: run.id }),
    })
    expect(lido.status).toBe(200)

    const rotasSemTeto = rotasDaConversa(m.deps(conta.id))
    await rotasSemTeto.conversa(new Request("http://x/api/conversa"))
    await rotasSemTeto.run(new Request(`http://x/api/runs/${run.id}`), {
      params: Promise.resolve({ id: run.id }),
    })
    expect(await usoDoToque(m, conta)).toEqual(antes)
  })
})

// Rotas: a lista do eval. Cada arquivo de `src/app/api/**/route.ts` que exporta POST ou GET tem de estar aqui.
type Rota = {
  arquivo: string
  metodo: "GET" | "POST"
  nome: string
  corpo?: unknown
  // POST /api/runs: o limite é o de mensagem, não o de toque; o teste dele é outro.
  mensagem?: boolean
  // Rota fora do limite de toque, com o motivo.
  excecao?: string
  chamar?: (request: Request) => Promise<Response>
}

const TROCA = { sugestao: 0, alimento_id: "arroz-branco", motivo: "trocar" }
const RESPOSTA_TROCA = {
  sugestao: 0,
  alimento_id: "arroz-branco",
  candidato: "cevada",
  resposta: "nao_tenho",
}

function tabela(deps: DepsDaRota, runId: string): Rota[] {
  const conversa = rotasDaConversa(deps)
  const fluxo = rotasDeFluxoDeRun(deps)
  const onboarding = rotasDeOnboarding(deps)
  const busca = rotasDeBusca(deps)
  const casa = rotasDaCasa(deps)
  const voce = rotasDoVoce(deps)
  const params = { params: Promise.resolve({ id: runId }) }
  const quiz = deps.container.knowledge.quiz.map((p) => ({ pergunta_id: p.id, dosha: "vata" }))
  const AUTH = "Auth.js: entrada com Google, fora do limite de toque"
  return [
    {
      arquivo: "src/app/api/runs/route.ts",
      metodo: "POST",
      nome: "POST /api/runs",
      mensagem: true,
      corpo: MENSAGEM,
      chamar: fluxo.iniciar,
    },
    {
      arquivo: "src/app/api/runs/[id]/resposta/route.ts",
      metodo: "POST",
      nome: "POST /api/runs/:id/resposta",
      corpo: { tipo: "pular" },
      chamar: (r) => fluxo.responder(r, params),
    },
    {
      arquivo: "src/app/api/runs/[id]/aprovacao/route.ts",
      metodo: "POST",
      nome: "POST /api/runs/:id/aprovacao",
      corpo: { aprovadas: [] },
      chamar: (r) => conversa.aprovacao(r, params),
    },
    {
      arquivo: "src/app/api/runs/[id]/troca/route.ts",
      metodo: "POST",
      nome: "POST /api/runs/:id/troca",
      corpo: TROCA,
      chamar: (r) => conversa.troca(r, params),
    },
    {
      arquivo: "src/app/api/runs/[id]/troca/resposta/route.ts",
      metodo: "POST",
      nome: "POST /api/runs/:id/troca/resposta",
      corpo: RESPOSTA_TROCA,
      chamar: (r) => conversa.respostaDaTroca(r, params),
    },
    {
      arquivo: "src/app/api/runs/[id]/voto/route.ts",
      metodo: "POST",
      nome: "POST /api/runs/:id/voto",
      corpo: { voto: "up" },
      chamar: (r) => conversa.voto(r, params),
    },
    {
      arquivo: "src/app/api/onboarding/aviso/route.ts",
      metodo: "POST",
      nome: "POST /api/onboarding/aviso",
      chamar: onboarding.aviso,
    },
    {
      arquivo: "src/app/api/onboarding/evitar/route.ts",
      metodo: "POST",
      nome: "POST /api/onboarding/evitar",
      corpo: { passo: "nenhum" },
      chamar: onboarding.evitar,
    },
    {
      arquivo: "src/app/api/onboarding/perfil/route.ts",
      metodo: "POST",
      nome: "POST /api/onboarding/perfil",
      corpo: { dosha: "adiado", cidade: null },
      chamar: onboarding.perfil,
    },
    {
      arquivo: "src/app/api/onboarding/quiz/route.ts",
      metodo: "POST",
      nome: "POST /api/onboarding/quiz",
      corpo: { respostas: quiz },
      chamar: onboarding.quiz,
    },
    {
      arquivo: "src/app/api/casa/route.ts",
      metodo: "POST",
      nome: "POST /api/casa",
      corpo: { acao: "adicionar", alimento_id: "gengibre" },
      chamar: casa.tocarCasa,
    },
    {
      arquivo: "src/app/api/lista/route.ts",
      metodo: "POST",
      nome: "POST /api/lista",
      corpo: { acao: "por", alimento_id: "gengibre" },
      chamar: casa.lista,
    },
    {
      arquivo: "src/app/api/preferencias/route.ts",
      metodo: "POST",
      nome: "POST /api/preferencias",
      corpo: { alimento_id: "gengibre", gosto: "gosta" },
      chamar: casa.preferencias,
    },
    {
      arquivo: "src/app/api/retornos/[id]/route.ts",
      metodo: "POST",
      nome: "POST /api/retornos/:id",
      corpo: { resultado: "ajudou" },
      chamar: (r) => casa.responderRetorno(r, params),
    },
    {
      arquivo: "src/app/api/perfil/route.ts",
      metodo: "POST",
      nome: "POST /api/perfil",
      corpo: { acao: "dosha", doshas: ["vata"] },
      chamar: voce.tocarPerfil,
    },
    {
      arquivo: "src/app/api/memoria/route.ts",
      metodo: "POST",
      nome: "POST /api/memoria",
      corpo: { acao: "falta_apagar", alimento_id: "gengibre" },
      chamar: voce.tocarMemoria,
    },
    {
      arquivo: "src/app/api/auth/[...nextauth]/route.ts",
      metodo: "POST",
      nome: "POST /api/auth",
      excecao: AUTH,
    },
    {
      arquivo: "src/app/api/conversa/route.ts",
      metodo: "GET",
      nome: "GET /api/conversa",
      chamar: conversa.conversa,
    },
    {
      arquivo: "src/app/api/runs/[id]/route.ts",
      metodo: "GET",
      nome: "GET /api/runs/:id",
      chamar: (r) => conversa.run(r, params),
    },
    {
      arquivo: "src/app/api/alimentos/route.ts",
      metodo: "GET",
      nome: "GET /api/alimentos",
      chamar: (r) => busca.alimentos(r),
    },
    {
      arquivo: "src/app/api/cidades/route.ts",
      metodo: "GET",
      nome: "GET /api/cidades",
      chamar: (r) => busca.cidades(r),
    },
    {
      arquivo: "src/app/api/cron/limpeza/route.ts",
      metodo: "GET",
      nome: "GET /api/cron/limpeza",
      excecao: "Segredo próprio (CRON_SECRET), não é rota de toque",
    },
    {
      arquivo: "src/app/api/cron/padroes/route.ts",
      metodo: "GET",
      nome: "GET /api/cron/padroes",
      excecao: "Segredo próprio (CRON_SECRET), não é rota de toque",
    },
    {
      arquivo: "src/app/api/saude/route.ts",
      metodo: "GET",
      nome: "GET /api/saude",
      excecao: "Segredo próprio (CRON_SECRET), não é rota de toque",
    },
    {
      arquivo: "src/app/api/casa/route.ts",
      metodo: "GET",
      nome: "GET /api/casa",
      chamar: casa.lerCasa,
    },
    {
      arquivo: "src/app/api/retornos/route.ts",
      metodo: "GET",
      nome: "GET /api/retornos",
      chamar: casa.lerRetornos,
    },
    {
      arquivo: "src/app/api/voce/route.ts",
      metodo: "GET",
      nome: "GET /api/voce",
      chamar: voce.lerVoce,
    },
    {
      arquivo: "src/app/api/auth/[...nextauth]/route.ts",
      metodo: "GET",
      nome: "GET /api/auth",
      excecao: AUTH,
    },
  ]
}

// Arquivos de `src/app/api` que exportam o método: `export const POST`, `export async function POST` ou `export const { GET, POST }`.
function arquivosQueExportam(metodo: "GET" | "POST"): string[] {
  const raiz = `${RAIZ}src/app/api`
  const nomes = readdirSync(raiz, { recursive: true }) as string[]
  const direta = new RegExp(`export\\s+(async\\s+function|function|const)\\s+${metodo}\\b`)
  const desestruturada = new RegExp(`export\\s+const\\s*\\{[^}]*\\b${metodo}\\b[^}]*\\}`)
  return nomes
    .filter((n) => n.endsWith("route.ts"))
    .filter((n) => {
      const texto = readFileSync(`${raiz}/${n}`, "utf8")
      return direta.test(texto) || desestruturada.test(texto)
    })
    .map((n) => `src/app/api/${n.split("\\").join("/")}`)
    .sort()
}

const semNaLista = (lista: string[], tabelaArquivos: string[]) =>
  lista.filter((a) => !tabelaArquivos.includes(a))

// Escritas que as rotas de toque podem chamar: nenhuma pode rodar numa rota barrada.
function espioesDeEscrita(c: Container) {
  return [
    vi.spyOn(c.conversation, "aprovar"),
    vi.spyOn(c.conversation, "continuar"),
    vi.spyOn(c.conversation, "conversar"),
    vi.spyOn(c.touches, "trocarIngrediente"),
    vi.spyOn(c.touches, "responderTroca"),
    vi.spyOn(c.touches, "tocarVoto"),
    vi.spyOn(c.touches, "tocarCasa"),
    vi.spyOn(c.touches, "tocarLista"),
    vi.spyOn(c.touches, "tocarGosto"),
    vi.spyOn(c.touches, "tocarRetorno"),
    vi.spyOn(c.touches, "tocarPerfil"),
    vi.spyOn(c.touches, "tocarMemoria"),
    vi.spyOn(c.stores.accounts, "marcar"),
    vi.spyOn(c.stores.profiles, "acrescentarEvitarSempre"),
    vi.spyOn(c.stores.profiles, "definirCidade"),
    vi.spyOn(c.stores.profiles, "definirPrakriti"),
    vi.spyOn(c.stores.runs, "criar"),
  ]
}

const NOMES_DE_POST = tabela(montar().deps(undefined), RUN_FIXO)
  .filter((r) => r.metodo === "POST" && r.chamar && !r.mensagem)
  .map((r) => r.nome)

const NOMES_DE_GET = tabela(montar().deps(undefined), RUN_FIXO)
  .filter((r) => r.metodo === "GET" && r.chamar)
  .map((r) => r.nome)

describe("lista de rotas de toque", () => {
  it("todo arquivo que exporta POST está na lista do eval", () => {
    const listados = tabela(montar().deps(undefined), RUN_FIXO)
      .filter((r) => r.metodo === "POST")
      .map((r) => r.arquivo)
    expect(semNaLista(arquivosQueExportam("POST"), listados)).toEqual([])
  })

  it("todo arquivo que exporta GET está na lista do eval", () => {
    const listados = tabela(montar().deps(undefined), RUN_FIXO)
      .filter((r) => r.metodo === "GET")
      .map((r) => r.arquivo)
    expect(semNaLista(arquivosQueExportam("GET"), listados)).toEqual([])
  })

  it("nenhuma linha da lista aponta para arquivo que não exporta o método", () => {
    const linhas = tabela(montar().deps(undefined), RUN_FIXO)
    const sobrando = linhas.filter((r) => !arquivosQueExportam(r.metodo).includes(r.arquivo))
    expect(sobrando.map((r) => r.nome)).toEqual([])
  })

  it.each(NOMES_DE_POST)(
    "%s com teto de toque zero: 429 limite_toques com Retry-After",
    async (nome) => {
      const m = montar()
      const conta = await contaGoogle(m, `lista-${nome.length}`)
      const espioes = espioesDeEscrita(m.container)
      const rota = tabela(m.deps(conta.id, { teto: 0 }), RUN_FIXO).find((r) => r.nome === nome)
      if (!rota?.chamar) throw new Error(`rota ${nome} sem chamada`)

      const b = await barrada(await rota.chamar(pedido(rota.corpo)))
      expect(b.status).toBe(429)
      expect(b.corpo.erro).toBe("limite_toques")
      expect(b.retry).toBeGreaterThanOrEqual(1)
      for (const espiao of espioes) expect(espiao).not.toHaveBeenCalled()
    },
  )

  it("controle: a rota de voto sem teto zerado responde 200 e chama a escrita", async () => {
    const m = montar()
    const { conta, run } = await contaComRun(m, "controle-lista")
    const espiao = vi.spyOn(m.container.touches, "tocarVoto")
    const rota = tabela(m.deps(conta.id), run.id).find((r) => r.nome === "POST /api/runs/:id/voto")
    if (!rota?.chamar) throw new Error("rota de voto ausente")
    const r = await rota.chamar(pedido(rota.corpo))
    expect(r.status).toBe(200)
    expect(espiao).toHaveBeenCalledTimes(1)
  })

  it("POST /api/runs fica no limite de mensagem, e não no de toque: está na lista", () => {
    const linha = tabela(montar().deps(undefined), RUN_FIXO).find(
      (r) => r.nome === "POST /api/runs",
    )
    expect(linha?.mensagem).toBe(true)
  })

  it.each(NOMES_DE_GET)("%s não consome toque", async (nome) => {
    const m = montar()
    const { conta, run } = await contaComRun(m, `get-${nome.length}`)
    await tocarVoto(m, conta.id, run.id)
    const antes = await usoDoToque(m, conta)
    const rota = tabela(m.deps(conta.id), run.id).find((r) => r.nome === nome)
    if (!rota?.chamar) throw new Error(`rota ${nome} sem chamada`)

    const r = await rota.chamar(new Request("http://x/api/leitura?q=ar"))
    expect(r.status).not.toBe(429)
    expect(await usoDoToque(m, conta)).toEqual(antes)
  })
})
