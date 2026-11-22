import { describe, expect, it } from "vitest"
import { rotasDoVoce } from "@/app/_rotas/voce"
import { diaLocal } from "@/core/time/dia-local"
import { createContainer } from "@/infra/container"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { cenarios, montarCenario } from "../../../test/fixtures/cenarios"

// Você: rotas sem sessão recusam; nota, padrão e conversa de outra conta são recusados e nada muda; a leitura não
// traz dado de outra conta; o rastro de outra conta não é lido; `evitar_tirar` sem confirmação recusa; apagar a
// conta não deixa nada dela. O relógio é o do cenário frio-agitada, então o momento do dia não muda.

const FUSO = "America/Sao_Paulo"
const UUID_DE_FORA = "7f0c9a4e-1b2d-4c3e-8f5a-6b7c8d9e0f1a"
const SEGREDO_B = "segredo-da-conta-b"
const FRASE_B = "frase-de-padrao-da-conta-b"

function frioAgitada() {
  const c = cenarios["frio-agitada"]
  if (!c?.entrada) throw new Error("cenário frio-agitada ausente")
  return c
}

// A conta A (da sessão) e as rotas do Você sobre o container do cenário.
async function montar() {
  const c = frioAgitada()
  const { contaId, deps } = await montarCenario(c)
  const container = createContainer({
    clock: deps.clock,
    stores: deps.stores,
    tx: { emTransacao: (fn) => fn(deps.stores) },
    telemetry: deps.telemetry,
    limiter: createMemoryLimiter(),
  })
  const dia = diaLocal(new Date(c.agora), FUSO)
  const rotas = (sessao?: string) =>
    rotasDoVoce({ contaDaSessao: async () => sessao, container, quemPede: () => ({ ipHash: "h" }) })
  return { c, contaId, deps, container, dia, rotas, sessao: contaId }
}

type Montagem = Awaited<ReturnType<typeof montar>>

const pedido = (url: string, corpo: unknown): Request =>
  new Request(url, { method: "POST", body: JSON.stringify(corpo) })

// Conta B com nota de rotina, padrão candidato e uma mensagem de hoje: nada disso pode vazar nem mudar.
async function outraConta(m: Montagem) {
  const { stores } = m.deps
  const b = await stores.accounts.criar({ tipo: "demo" })
  const nota = await stores.routine.anotar(b.id, SEGREDO_B)
  const padrao = await stores.patterns.propor(b.id, {
    tipo: "ajuda_em_estado",
    chave: "chave-b",
    frase: FRASE_B,
    ocorrencias: 3,
  })
  if (!padrao) throw new Error("padrão de B não criado")
  await stores.messages.gravar(b.id, {
    autor: "pessoa",
    texto: SEGREDO_B,
    com_incomodo: false,
    dia: m.dia,
  })
  return { b, nota, padrao }
}

// O que a conta tem nas leituras que o Você mostra e que outra conta não pode alterar.
async function estadoDe(m: Montagem, contaId: string): Promise<string> {
  return JSON.stringify({
    notas: await m.deps.stores.routine.notasAtivas(contaId),
    padroes: await m.deps.stores.patterns.listar(contaId),
    mensagens: await m.deps.stores.messages.doDia(contaId, m.dia),
  })
}

describe("rotas do Você sem sessão", () => {
  const casos = [
    {
      nome: "GET /api/voce",
      chamar: (r: ReturnType<Montagem["rotas"]>) => r.lerVoce(new Request("http://x/api/voce")),
    },
    {
      nome: "POST /api/perfil",
      chamar: (r: ReturnType<Montagem["rotas"]>) =>
        r.tocarPerfil(pedido("http://x/api/perfil", { acao: "cidade", cidade: null })),
    },
    {
      nome: "POST /api/memoria",
      chamar: (r: ReturnType<Montagem["rotas"]>) =>
        r.tocarMemoria(
          pedido("http://x/api/memoria", { acao: "nota_apagar", nota_id: UUID_DE_FORA }),
        ),
    },
  ]

  it.each(casos)("$nome responde 401 sem_sessao", async ({ chamar }) => {
    const m = await montar()

    const resposta = await chamar(m.rotas(undefined))

    expect(resposta.status).toBe(401)
    expect(await resposta.json()).toEqual({ erro: "sem_sessao" })
  })
})

describe("nota, padrão e conversa de outra conta", () => {
  const acoes = [
    {
      nome: "nota_corrigir",
      corpo: (n: string, _p: string) => ({
        acao: "nota_corrigir",
        nota_id: n,
        texto: "texto trocado",
      }),
    },
    {
      nome: "nota_apagar",
      corpo: (n: string, _p: string) => ({ acao: "nota_apagar", nota_id: n }),
    },
    {
      nome: "padrao_decidir",
      corpo: (_n: string, p: string) => ({
        acao: "padrao_decidir",
        padrao_id: p,
        decisao: "confirmado",
      }),
    },
    {
      nome: "padrao_apagar",
      corpo: (_n: string, p: string) => ({ acao: "padrao_apagar", padrao_id: p }),
    },
  ]

  it.each(acoes)("$nome com id de outra conta recusa e não grava nada", async ({ corpo }) => {
    const m = await montar()
    const { b, nota, padrao } = await outraConta(m)
    const antesB = await estadoDe(m, b.id)
    const antesA = await estadoDe(m, m.sessao)

    const resposta = await m
      .rotas(m.sessao)
      .tocarMemoria(pedido("http://x/api/memoria", corpo(nota.id, padrao.id)))

    expect(resposta.status).toBe(400)
    expect(await estadoDe(m, b.id)).toBe(antesB)
    expect(await estadoDe(m, m.sessao)).toBe(antesA)
  })

  it("conversa_apagar do dia da conta A não apaga a conversa da conta B", async () => {
    const m = await montar()
    const { b } = await outraConta(m)
    const antesB = await estadoDe(m, b.id)

    const resposta = await m
      .rotas(m.sessao)
      .tocarMemoria(pedido("http://x/api/memoria", { acao: "conversa_apagar", dia: m.dia }))

    expect(resposta.status).toBe(200)
    expect(await estadoDe(m, b.id)).toBe(antesB)
  })
})

describe("leitura do Você não traz nada de outra conta", () => {
  it("GET /api/voce mostra a conta A e nunca a nota, o padrão nem a mensagem da conta B", async () => {
    const m = await montar()
    await outraConta(m)

    const resposta = await m.rotas(m.sessao).lerVoce(new Request("http://x/api/voce"))

    expect(resposta.status).toBe(200)
    const texto = JSON.stringify(await resposta.json())
    expect(texto).not.toContain(SEGREDO_B)
    expect(texto).not.toContain(FRASE_B)
  })
})

describe("rastro de outra conta", () => {
  it("lerComoPensei com o run de outra conta é undefined; com o da própria conta, não", async () => {
    const m = await montar()
    const { b } = await outraConta(m)
    const r = await m.deps.companion.responder(m.sessao, frioAgitada().entrada)
    if (!r.run_id) throw new Error("run sem id")

    expect(await m.container.lerComoPensei(b.id, r.run_id)).toBeUndefined()
    expect(await m.container.lerComoPensei(m.sessao, r.run_id)).toBeDefined()
  })
})

describe("evitar_tirar sem confirmação", () => {
  it("POST /api/perfil com evitar_tirar sem confirmado responde 400 e não muda o perfil", async () => {
    const m = await montar()
    const antes = JSON.stringify(await m.deps.stores.profiles.ler(m.sessao))

    const resposta = await m.rotas(m.sessao).tocarPerfil(
      pedido("http://x/api/perfil", {
        acao: "evitar_tirar",
        item: { tipo: "texto", valor: "pimenta" },
      }),
    )

    expect(resposta.status).toBe(400)
    expect(JSON.stringify(await m.deps.stores.profiles.ler(m.sessao))).toBe(antes)
  })
})

describe("apagar a conta", () => {
  it("não deixa nada da conta e a conta não é mais achada; a outra conta fica como estava", async () => {
    const m = await montar()
    const { b } = await outraConta(m)
    const antesB = await estadoDe(m, b.id)
    const conta = await m.deps.stores.accounts.buscar(m.sessao)
    if (!conta) throw new Error("conta da cena não encontrada")
    expect((await m.deps.stores.profiles.ler(m.sessao))?.cidade_nome).not.toBeNull()

    await m.container.accounts.apagarConta(conta)

    expect(await m.deps.stores.accounts.buscar(m.sessao)).toBeUndefined()
    expect(await m.deps.stores.pantry.listar(m.sessao)).toEqual([])
    expect(await m.deps.stores.routine.notasAtivas(m.sessao)).toEqual([])
    expect(await m.deps.stores.patterns.listar(m.sessao)).toEqual([])
    expect(await m.deps.stores.messages.doDia(m.sessao, m.dia)).toEqual([])
    expect((await m.deps.stores.profiles.ler(m.sessao))?.cidade_nome ?? null).toBeNull()
    expect(await estadoDe(m, b.id)).toBe(antesB)
  })
})
