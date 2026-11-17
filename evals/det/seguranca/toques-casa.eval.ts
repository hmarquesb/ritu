import { afterEach, describe, expect, it, vi } from "vitest"
import { rotasDaCasa } from "@/app/_rotas/casa"
import { createContainer } from "@/infra/container"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryStores } from "@/infra/fakes/memory-stores"

// Rotas da Minha casa e do Como ficou: sem sessão recusam; o item, o retorno e o alimento de outra conta são
// recusados com toque_invalido e nada muda; as leituras não trazem nada de outra conta.

const AGORA = new Date("2026-03-10T15:00:00.000Z")
const UUID_DE_FORA = "7f0c9a4e-1b2d-4c3e-8f5a-6b7c8d9e0f1a"
const SEGREDO_B = "segredo-da-conta-b"
const ITEM_A = "item-da-conta-a"

function montar() {
  vi.stubEnv("RITU_MODO", "e2e")
  const clock = { now: () => AGORA }
  const stores = createMemoryStores(clock)
  const container = createContainer({ clock, stores, tx: stores, limiter: createMemoryLimiter() })
  const rotas = (contaId?: string) =>
    rotasDaCasa({
      contaDaSessao: async () => contaId,
      quemPede: () => ({ ipHash: "h" }),
      container,
    })
  return { stores, rotas }
}

type Montagem = ReturnType<typeof montar>

const pedido = (corpo: unknown): Request =>
  new Request("http://x/api/casa", { method: "POST", body: JSON.stringify(corpo) })

const comId = (id: string) => ({ params: Promise.resolve({ id }) })

// Conta A (a da sessão) e conta B com item da casa, alimento na lista, retorno pendente e um texto que não pode vazar.
async function duasContas(m: Montagem) {
  const { stores } = m
  const a = await stores.accounts.criar({ tipo: "google", google_sub: "sa", email: "a@x.y" })
  const b = await stores.accounts.criar({ tipo: "google", google_sub: "sb", email: "b@x.y" })
  await stores.pantry.registrar(a.id, [{ nome_livre: ITEM_A }], "tela")
  await stores.pantry.registrar(b.id, [{ nome_livre: SEGREDO_B }], "tela")
  await stores.shortages.porNaLista(b.id, {
    alimento_id: "arroz-branco",
    motivo: "pessoa",
    detalhe: "",
  })
  const [retornoB] = await stores.outcomes.criar(b.id, "run-b", [
    {
      tipo: "cha",
      pratica_id: "cha-gengibre",
      alimentos: ["gengibre", "canela"],
      titulo: SEGREDO_B,
    },
  ])
  if (!retornoB) throw new Error("retorno de B não criado")
  const itemB = (await stores.pantry.listar(b.id)).find((i) => i.nome_livre === SEGREDO_B)
  if (!itemB) throw new Error("item de B não criado")
  return { a, b, itemB, retornoB }
}

// O que a conta B tem nas três leituras que a conta A não pode alterar.
async function estadoDeB(m: Montagem, bId: string) {
  return JSON.stringify({
    casa: await m.stores.pantry.listar(bId),
    lista: await m.stores.shortages.lista(bId),
    pendentes: await m.stores.outcomes.pendentes(bId),
  })
}

function casosSemSessao(rotas: ReturnType<Montagem["rotas"]>) {
  return [
    { nome: "GET /api/casa", chamar: () => rotas.lerCasa(new Request("http://x/api/casa")) },
    {
      nome: "POST /api/casa",
      chamar: () => rotas.tocarCasa(pedido({ acao: "adicionar", alimento_id: "gengibre" })),
    },
    {
      nome: "POST /api/preferencias",
      chamar: () => rotas.preferencias(pedido({ alimento_id: "gengibre", gosto: "gosta" })),
    },
    {
      nome: "POST /api/lista",
      chamar: () => rotas.lista(pedido({ acao: "por", alimento_id: "gengibre" })),
    },
    {
      nome: "GET /api/retornos",
      chamar: () => rotas.lerRetornos(new Request("http://x/api/retornos")),
    },
    {
      nome: "POST /api/retornos/:id",
      chamar: () => rotas.responderRetorno(pedido({ resultado: "ajudou" }), comId(UUID_DE_FORA)),
    },
  ]
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("rotas da casa sem sessão", () => {
  const nomes = casosSemSessao(montar().rotas(undefined)).map((c) => c.nome)

  it.each(nomes)("%s responde 401 sem_sessao", async (nome) => {
    const m = montar()
    const caso = casosSemSessao(m.rotas(undefined)).find((c) => c.nome === nome)
    if (!caso) throw new Error(`rota ${nome} não montada`)
    const resposta = await caso.chamar()
    expect(resposta.status).toBe(401)
    expect(await resposta.json()).toEqual({ erro: "sem_sessao" })
  })
})

describe("item da casa de outra conta", () => {
  const acoes = [
    { acao: "tenho" },
    { acao: "acabou" },
    { acao: "sempre_tenho", valor: true },
    { acao: "tirar" },
  ] as const

  it.each(acoes)(
    "$acao recusa item de outra conta com 400 toque_invalido e não grava",
    async (base) => {
      const m = montar()
      const { a, b, itemB } = await duasContas(m)
      const antes = await estadoDeB(m, b.id)

      const resposta = await m.rotas(a.id).tocarCasa(pedido({ ...base, item_id: itemB.id }))

      expect(resposta.status).toBe(400)
      expect(await resposta.json()).toEqual({ erro: "toque_invalido" })
      expect(await estadoDeB(m, b.id)).toBe(antes)
    },
  )
})

describe("retorno de outra conta", () => {
  it("POST /api/retornos/:id recusa com 400 toque_invalido e não fecha o retorno de B", async () => {
    const m = montar()
    const { a, b, retornoB } = await duasContas(m)
    const antes = await estadoDeB(m, b.id)

    const resposta = await m
      .rotas(a.id)
      .responderRetorno(pedido({ resultado: "ajudou" }), comId(retornoB.id))

    expect(resposta.status).toBe(400)
    expect(await resposta.json()).toEqual({ erro: "toque_invalido" })
    expect(await estadoDeB(m, b.id)).toBe(antes)
  })
})

describe("alimento da lista de outra conta", () => {
  // A lista é por conta e por alimento: tirar um alimento que não está na lista da conta da sessão não tem efeito.
  // O que precisa valer é a lista de B ficar como está.
  it("POST /api/lista com alimento que só está na lista de B não muda a lista de B", async () => {
    const m = montar()
    const { a, b } = await duasContas(m)
    const antes = await estadoDeB(m, b.id)

    const resposta = await m
      .rotas(a.id)
      .lista(pedido({ acao: "tirar", alimento_id: "arroz-branco" }))

    expect(resposta.status).not.toBe(500)
    expect(await estadoDeB(m, b.id)).toBe(antes)
  })
})

describe("leituras não trazem nada de outra conta", () => {
  it("GET /api/casa mostra o item da conta A e nunca o da conta B", async () => {
    const m = montar()
    const { a } = await duasContas(m)

    const resposta = await m.rotas(a.id).lerCasa(new Request("http://x/api/casa"))

    expect(resposta.status).toBe(200)
    const texto = JSON.stringify(await resposta.json())
    expect(texto).toContain(ITEM_A)
    expect(texto).not.toContain(SEGREDO_B)
    expect(texto).not.toContain("arroz-branco")
  })

  it("GET /api/retornos não traz o retorno nem o título da conta B", async () => {
    const m = montar()
    const { a, retornoB } = await duasContas(m)

    const resposta = await m.rotas(a.id).lerRetornos(new Request("http://x/api/retornos"))

    expect(resposta.status).toBe(200)
    const texto = JSON.stringify(await resposta.json())
    expect(texto).not.toContain(retornoB.id)
    expect(texto).not.toContain(SEGREDO_B)
  })
})
