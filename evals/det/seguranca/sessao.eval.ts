import { afterEach, describe, expect, it, vi } from "vitest"
import type { DepsDaRota } from "@/app/_lib/rota"
import { rotasDeBusca } from "@/app/_rotas/busca"
import { rotasDeOnboarding } from "@/app/_rotas/onboarding"
import { criarDemonstracao } from "@/core/accounts/entrar"
import { createContainer } from "@/infra/container"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryStores } from "@/infra/fakes/memory-stores"

const AGORA = new Date("2026-03-10T15:00:00.000Z")
const HORA_MS = 3_600_000

type Montagem = ReturnType<typeof montar>

// Container em memória (modo e2e, sem banco nem rede). A sessão é fingida pelo contaDaSessao.
function montar() {
  vi.stubEnv("RITU_MODO", "e2e")
  let agora = AGORA
  const clock = { now: () => agora }
  const stores = createMemoryStores(clock)
  const container = createContainer({
    clock,
    stores,
    tx: stores,
    limiter: createMemoryLimiter(),
  })
  return {
    container,
    stores,
    avancarHoras(horas: number) {
      agora = new Date(agora.getTime() + horas * HORA_MS)
    },
    deps: (contaId?: string): DepsDaRota => ({
      contaDaSessao: async () => contaId,
      quemPede: () => ({ ipHash: "h" }),
      container,
    }),
  }
}

type Rota = { rota: (request: Request) => Promise<Response>; metodo: string; url: string }

// Todas as rotas desta spec: onboarding (aviso, evitar, perfil, quiz) e busca (cidades, alimentos).
function rotasDaSpec(deps: DepsDaRota): Record<string, Rota> {
  const onboarding = rotasDeOnboarding(deps)
  const busca = rotasDeBusca(deps)
  return {
    aviso: { rota: onboarding.aviso, metodo: "POST", url: "http://x/api/onboarding/aviso" },
    evitar: { rota: onboarding.evitar, metodo: "POST", url: "http://x/api/onboarding/evitar" },
    perfil: { rota: onboarding.perfil, metodo: "POST", url: "http://x/api/onboarding/perfil" },
    quiz: { rota: onboarding.quiz, metodo: "POST", url: "http://x/api/onboarding/quiz" },
    cidades: { rota: busca.cidades, metodo: "GET", url: "http://x/api/cidades?q=sao" },
    alimentos: { rota: busca.alimentos, metodo: "GET", url: "http://x/api/alimentos?q=arr" },
  }
}

function pedidoDe(r: Rota): Request {
  return new Request(r.url, { method: r.metodo })
}

// Demonstração criada pelo caminho real, sem semear a casa (o teste não precisa dela).
async function criarDemo(m: Montagem, ipHash: string): Promise<string> {
  const { container } = m
  const conta = await criarDemonstracao(
    {
      tx: container.tx,
      limiter: container.limiter,
      clock: container.clock,
      kb: container.knowledge,
      seed: container.demoSeed,
      telemetry: container.telemetry,
    },
    { ipHash, semSeed: true },
  )
  return conta.id
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("rotas da spec sem sessão", () => {
  const nomes = Object.keys(rotasDaSpec(montar().deps(undefined)))

  it.each(nomes)("%s responde 401 sem_sessao", async (nome) => {
    const rotas = rotasDaSpec(montar().deps(undefined))
    const r = rotas[nome] as Rota
    const resposta = await r.rota(pedidoDe(r))
    expect(resposta.status).toBe(401)
    expect(await resposta.json()).toEqual({ erro: "sem_sessao" })
  })
})

describe("demonstração vencida", () => {
  it("com a conta de demonstração vencida (25 h depois), todas as rotas respondem 401", async () => {
    const m = montar()
    const contaId = await criarDemo(m, "demo-vencida")
    const rotas = rotasDaSpec(m.deps(contaId))
    m.avancarHoras(25)
    for (const [nome, r] of Object.entries(rotas)) {
      const resposta = await r.rota(pedidoDe(r))
      expect(resposta.status, nome).toBe(401)
    }
  })

  it("a mesma demonstração antes do prazo responde 200 na rota de aviso", async () => {
    const m = montar()
    const contaId = await criarDemo(m, "demo-viva")
    const r = rotasDaSpec(m.deps(contaId)).aviso as Rota
    const resposta = await r.rota(pedidoDe(r))
    expect(resposta.status).toBe(200)
  })
})

describe("isolamento entre contas", () => {
  it("a conta A não muda o onboarding da conta B", async () => {
    const m = montar()
    const a = await m.stores.accounts.criar({ tipo: "google", google_sub: "sa", email: "a@x.y" })
    const b = await m.stores.accounts.criar({ tipo: "google", google_sub: "sb", email: "b@x.y" })
    const rotasA = rotasDaSpec(m.deps(a.id))
    const aviso = rotasA.aviso as Rota
    const perfil = rotasA.perfil as Rota

    const respostaAviso = await aviso.rota(pedidoDe(aviso))
    const respostaPerfil = await perfil.rota(
      new Request("http://x/api/onboarding/perfil", {
        method: "POST",
        body: JSON.stringify({ dosha: "adiado", cidade: null }),
      }),
    )

    expect(respostaAviso.status).toBe(200)
    expect(respostaPerfil.status).toBe(200)
    const contaA = await m.stores.accounts.buscar(a.id)
    expect(contaA?.aviso_aceito_em).not.toBeNull()
    expect(contaA?.dosha_adiado_em).not.toBeNull()
    const contaB = await m.stores.accounts.buscar(b.id)
    expect(contaB?.aviso_aceito_em).toBeNull()
    expect(contaB?.dosha_adiado_em).toBeNull()
  })
})
