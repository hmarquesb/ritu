import { afterEach, describe, expect, it, vi } from "vitest"
import type { DepsDaRota } from "@/app/_lib/rota"
import { rotasDaConversa } from "@/app/_rotas/conversa"
import { rotasDeFluxoDeRun } from "@/app/_rotas/fluxo-de-run"
import { diaLocal } from "@/core/time/dia-local"
import { createContainer } from "@/infra/container"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryStores } from "@/infra/fakes/memory-stores"

const AGORA = new Date("2026-03-10T15:00:00.000Z")
const DIA = diaLocal(AGORA)
const SEGREDO_B = "segredo-da-conta-b"

// Container em memória (modo e2e, sem banco nem rede). A sessão é fingida pelo contaDaSessao.
function montar() {
  vi.stubEnv("RITU_MODO", "e2e")
  const clock = { now: () => AGORA }
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
    deps: (contaId?: string): DepsDaRota => ({
      contaDaSessao: async () => contaId,
      quemPede: () => ({ ipHash: "h" }),
      container,
    }),
  }
}

type Montagem = ReturnType<typeof montar>

type Chamada = {
  nome: string
  metodo: "GET" | "POST"
  url: string
  corpo?: unknown
  // Rota que lê o run do caminho: a conta de outro run recebe 404.
  comRun: boolean
  chamar: (request: Request) => Promise<Response>
}

const MENSAGEM = { texto: "oi" }
const TROCA = { sugestao: 0, alimento_id: "arroz-branco", motivo: "trocar" }

// Todas as rotas da 018 que tocam conversa, run, aprovação, troca, resposta e voto.
function chamadas(deps: DepsDaRota, runId: string): Chamada[] {
  const conversa = rotasDaConversa(deps)
  const fluxo = rotasDeFluxoDeRun(deps)
  const params = { params: Promise.resolve({ id: runId }) }
  const base = `http://x/api/runs/${runId}`
  return [
    {
      nome: "GET /api/conversa",
      metodo: "GET",
      url: "http://x/api/conversa",
      comRun: false,
      chamar: conversa.conversa,
    },
    {
      nome: "POST /api/runs",
      metodo: "POST",
      url: "http://x/api/runs",
      corpo: MENSAGEM,
      comRun: false,
      chamar: fluxo.iniciar,
    },
    {
      nome: "GET /api/runs/:id",
      metodo: "GET",
      url: base,
      comRun: true,
      chamar: (r) => conversa.run(r, params),
    },
    {
      nome: "POST /api/runs/:id/resposta",
      metodo: "POST",
      url: `${base}/resposta`,
      corpo: { tipo: "pular" },
      comRun: true,
      chamar: (r) => fluxo.responder(r, params),
    },
    {
      nome: "POST /api/runs/:id/aprovacao",
      metodo: "POST",
      url: `${base}/aprovacao`,
      corpo: { aprovadas: [] },
      comRun: true,
      chamar: (r) => conversa.aprovacao(r, params),
    },
    {
      nome: "POST /api/runs/:id/troca",
      metodo: "POST",
      url: `${base}/troca`,
      corpo: TROCA,
      comRun: true,
      chamar: (r) => conversa.troca(r, params),
    },
    {
      nome: "POST /api/runs/:id/troca/resposta",
      metodo: "POST",
      url: `${base}/troca/resposta`,
      corpo: {
        sugestao: TROCA.sugestao,
        alimento_id: TROCA.alimento_id,
        candidato: "cevada",
        resposta: "nao_tenho",
      },
      comRun: true,
      chamar: (r) => conversa.respostaDaTroca(r, params),
    },
    {
      nome: "POST /api/runs/:id/voto",
      metodo: "POST",
      url: `${base}/voto`,
      corpo: { voto: "up" },
      comRun: true,
      chamar: (r) => conversa.voto(r, params),
    },
  ]
}

function pedidoDe(c: Chamada): Request {
  return new Request(c.url, {
    method: c.metodo,
    ...(c.corpo !== undefined ? { body: JSON.stringify(c.corpo) } : {}),
  })
}

// Conta A (a da sessão), conta B com um run aberto, uma fala e um texto de resposta que não podem vazar.
async function duasContas(m: Montagem) {
  const { stores } = m
  const a = await stores.accounts.criar({ tipo: "google", google_sub: "sa", email: "a@x.y" })
  const b = await stores.accounts.criar({ tipo: "google", google_sub: "sb", email: "b@x.y" })
  const runB = await stores.runs.criar(b.id, { caminho: "acompanhante", intencoes: [], dia: DIA })
  await stores.runs.atualizar(b.id, runB.id, {
    status: "waiting_for_approval",
    saida: { resposta: SEGREDO_B },
  })
  await stores.messages.gravar(b.id, {
    run_id: runB.id,
    autor: "pessoa",
    texto: SEGREDO_B,
    com_incomodo: false,
    dia: DIA,
  })
  return { a, b, runB }
}

async function estadoDeB(m: Montagem, bId: string, runId: string) {
  return {
    mensagens: await m.stores.messages.doDia(bId, DIA),
    votos: await m.stores.runs.votos(bId, [runId]),
    run: await m.stores.runs.buscar(bId, runId),
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("rotas da conversa sem sessão", () => {
  const nomes = chamadas(montar().deps(undefined), "00000000-0000-4000-8000-000000000000").map(
    (c) => c.nome,
  )

  it.each(nomes)("%s responde 401 sem_sessao", async (nome) => {
    const m = montar()
    const c = chamadas(m.deps(undefined), "00000000-0000-4000-8000-000000000000").find(
      (x) => x.nome === nome,
    )
    if (!c) throw new Error(`rota ${nome} não montada`)
    const resposta = await c.chamar(pedidoDe(c))
    expect(resposta.status).toBe(401)
    expect(await resposta.json()).toEqual({ erro: "sem_sessao" })
  })
})

describe("run de outra conta", () => {
  it("as rotas de run respondem 404 run_nao_encontrado para a conta A", async () => {
    const m = montar()
    const { a, runB } = await duasContas(m)
    for (const c of chamadas(m.deps(a.id), runB.id).filter((x) => x.comRun)) {
      const resposta = await c.chamar(pedidoDe(c))
      expect(resposta.status, c.nome).toBe(404)
      expect(await resposta.json(), c.nome).toEqual({ erro: "run_nao_encontrado" })
    }
  })

  it("nenhuma escrita da rota de run de outra conta chega ao serviço nem ao banco", async () => {
    const m = montar()
    const { container, stores } = m
    const { a, b, runB } = await duasContas(m)
    const antes = await estadoDeB(m, b.id, runB.id)
    const espioes = [
      vi.spyOn(container.conversation, "aprovar"),
      vi.spyOn(container.conversation, "continuar"),
      vi.spyOn(container.touches, "trocarIngrediente"),
      vi.spyOn(container.touches, "responderTroca"),
      vi.spyOn(container.touches, "tocarVoto"),
    ]

    for (const c of chamadas(m.deps(a.id), runB.id).filter((x) => x.comRun)) {
      await c.chamar(pedidoDe(c))
    }

    for (const espiao of espioes) expect(espiao).not.toHaveBeenCalled()
    expect(await estadoDeB(m, b.id, runB.id)).toEqual(antes)
    expect(await stores.runs.votos(b.id, [runB.id])).toEqual({})
  })

  it("controle: o próprio run da conta A responde 200", async () => {
    const m = montar()
    const { stores } = m
    const a = await stores.accounts.criar({ tipo: "google", google_sub: "sa2", email: "a2@x.y" })
    const runA = await stores.runs.criar(a.id, {
      caminho: "acompanhante",
      intencoes: [],
      dia: DIA,
    })
    const leitura = chamadas(m.deps(a.id), runA.id).find((x) => x.nome === "GET /api/runs/:id")
    if (!leitura) throw new Error("rota de leitura do run não montada")
    const resposta = await leitura.chamar(pedidoDe(leitura))
    expect(resposta.status).toBe(200)
  })
})

describe("conversa do dia", () => {
  it("não traz fala nem run de outra conta", async () => {
    const m = montar()
    const { stores } = m
    const { a, runB } = await duasContas(m)
    const runA = await stores.runs.criar(a.id, { caminho: "acompanhante", intencoes: [], dia: DIA })
    await stores.messages.gravar(a.id, {
      run_id: runA.id,
      autor: "pessoa",
      texto: "fala-da-conta-a",
      com_incomodo: false,
      dia: DIA,
    })
    // Mensagem da conta A que cita o run da conta B: o run não pode aparecer na visão.
    await stores.messages.gravar(a.id, {
      run_id: runB.id,
      autor: "agente",
      texto: "fala-que-cita-o-run-de-b",
      com_incomodo: false,
      dia: DIA,
    })

    const conversa = rotasDaConversa(m.deps(a.id)).conversa
    const resposta = await conversa(new Request("http://x/api/conversa"))
    expect(resposta.status).toBe(200)
    const corpo = await resposta.json()

    expect(Object.keys(corpo.runs)).toContain(runA.id)
    expect(Object.keys(corpo.runs)).not.toContain(runB.id)
    expect(JSON.stringify(corpo)).not.toContain(SEGREDO_B)
    // O run aberto que aparece é o da própria conta A, nunca o de B.
    expect(corpo.aberto?.run_id).toBe(runA.id)
  })
})
