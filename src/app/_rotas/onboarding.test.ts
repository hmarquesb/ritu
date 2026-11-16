import { describe, expect, it, vi } from "vitest"
import type { DepsDaRota } from "@/app/_lib/rota"
import { createContainer } from "@/infra/container"
import { rotasDeOnboarding } from "./onboarding"

// Stores em memória (modo e2e) e a base real: a pasta de rotas não importa fakes.
const AGORA = "2026-03-10T15:00:00.000Z"

function montar() {
  vi.stubEnv("RITU_MODO", "e2e")
  const container = createContainer({ clock: { now: () => new Date(AGORA) } })
  const deps = (contaId?: string): DepsDaRota => ({
    contaDaSessao: async () => contaId,
    container,
  })
  return { container, stores: container.stores, kb: container.knowledge, deps }
}

function pedido(corpo?: unknown): Request {
  return new Request("http://x/api/onboarding", {
    method: "POST",
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
}

async function comConta(opcoes: { aviso?: boolean; evitar?: boolean } = {}, outraConta = false) {
  const m = montar()
  const conta = await m.stores.accounts.criar({ tipo: "google", google_sub: "s1", email: "a@b.c" })
  if (opcoes.aviso) await m.stores.accounts.marcar(conta.id, { aviso_aceito_em: AGORA })
  if (opcoes.evitar) await m.stores.accounts.marcar(conta.id, { evitar_passo: "nenhum" })
  const rotas = rotasDeOnboarding(m.deps(conta.id))
  const extra = outraConta
    ? await m.stores.accounts.criar({ tipo: "google", google_sub: "s2" })
    : undefined
  return { ...m, conta, extra, rotas }
}

// Uma resposta por pergunta da base, todas para o mesmo dosha.
function respostasTodas(perguntas: readonly { id: string }[], dosha: string) {
  return perguntas.map((p) => ({ pergunta_id: p.id, dosha }))
}

describe("rotasDeOnboarding", () => {
  it("401 sem sessão em todas as rotas", async () => {
    const { deps } = montar()
    const rotas = rotasDeOnboarding(deps(undefined))
    const chamadas = [
      rotas.aviso(pedido()),
      rotas.evitar(pedido({ passo: "nenhum" })),
      rotas.perfil(pedido({ dosha: "adiado", cidade: null })),
      rotas.quiz(pedido({ respostas: [] })),
    ]
    for (const resposta of await Promise.all(chamadas)) {
      expect(resposta.status).toBe(401)
      expect(await resposta.json()).toEqual({ erro: "sem_sessao" })
    }
  })

  describe("aviso", () => {
    it("grava o aceite e aponta para evitar", async () => {
      const { rotas, stores, conta } = await comConta()
      const r = await rotas.aviso(pedido({}))
      expect(r.status).toBe(200)
      expect(await r.json()).toEqual({ proximo: "/comecar/evitar" })
      expect((await stores.accounts.buscar(conta.id))?.aviso_aceito_em).toBe(AGORA)
    })

    it("aceita ser chamada de novo sem erro", async () => {
      const { rotas } = await comConta()
      expect((await rotas.aviso(pedido({}))).status).toBe(200)
      expect((await rotas.aviso(pedido({}))).status).toBe(200)
    })
  })

  describe("evitar", () => {
    it("grava grupo, alimento e texto sem duplicar e aponta para dosha", async () => {
      const { rotas, stores, conta, kb } = await comConta({ aviso: true })
      const itens = [
        { tipo: "grupo", valor: kb.gruposEvitar[0]?.id },
        { tipo: "alimento", valor: kb.alimentos[0]?.id },
        { tipo: "texto", valor: "pimenta-de-cheiro forte" },
      ]
      const r = await rotas.evitar(pedido({ passo: "pronto", itens }))
      expect(r.status).toBe(200)
      expect(await r.json()).toEqual({ proximo: "/comecar/dosha" })
      await rotas.evitar(pedido({ passo: "pronto", itens }))
      const perfil = await stores.profiles.ler(conta.id)
      expect(perfil.evitar_sempre.map(({ tipo, valor }) => ({ tipo, valor }))).toEqual(itens)
      expect((await stores.accounts.buscar(conta.id))?.evitar_passo).toBe("pronto")
    })

    it("400 com pronto sem itens", async () => {
      const { rotas } = await comConta({ aviso: true })
      const r = await rotas.evitar(pedido({ passo: "pronto", itens: [] }))
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "corpo_invalido" })
    })

    it("400 com grupo desconhecido", async () => {
      const { rotas } = await comConta({ aviso: true })
      const r = await rotas.evitar(
        pedido({ passo: "pronto", itens: [{ tipo: "grupo", valor: "nao-existe" }] }),
      )
      expect(r.status).toBe(400)
    })

    it("400 com alimento desconhecido", async () => {
      const { rotas } = await comConta({ aviso: true })
      const r = await rotas.evitar(
        pedido({ passo: "pronto", itens: [{ tipo: "alimento", valor: "nao-existe" }] }),
      )
      expect(r.status).toBe(400)
    })

    it("400 com 21 itens e com texto acima de 40 caracteres", async () => {
      const { rotas } = await comConta({ aviso: true })
      const muitos = Array.from({ length: 21 }, (_, i) => ({ tipo: "texto", valor: `item ${i}` }))
      expect((await rotas.evitar(pedido({ passo: "pronto", itens: muitos }))).status).toBe(400)
      const longo = [{ tipo: "texto", valor: "a".repeat(41) }]
      expect((await rotas.evitar(pedido({ passo: "pronto", itens: longo }))).status).toBe(400)
    })

    it("nenhum e pulou não pedem itens e não gravam evitar", async () => {
      for (const passo of ["nenhum", "pulou"] as const) {
        const { rotas, stores, conta } = await comConta({ aviso: true })
        const r = await rotas.evitar(pedido({ passo }))
        expect(r.status).toBe(200)
        expect(await r.json()).toEqual({ proximo: "/comecar/dosha" })
        expect((await stores.profiles.ler(conta.id)).evitar_sempre).toEqual([])
        expect((await stores.accounts.buscar(conta.id))?.evitar_passo).toBe(passo)
      }
    })

    it("guarda o texto livre como texto, sem interpretar", async () => {
      const { rotas, stores, conta } = await comConta({ aviso: true })
      await rotas.evitar(
        pedido({ passo: "pronto", itens: [{ tipo: "texto", valor: "Sopa de abóbora" }] }),
      )
      const [item] = (await stores.profiles.ler(conta.id)).evitar_sempre
      expect(item?.valor).toBe("Sopa de abóbora")
      expect(item?.tipo).toBe("texto")
    })
  })

  describe("perfil", () => {
    it("lista de doshas vira prakriti declarada e aponta para a conversa", async () => {
      const { rotas, stores, conta } = await comConta({ aviso: true, evitar: true })
      const r = await rotas.perfil(pedido({ dosha: ["vata", "pitta"], cidade: null }))
      expect(r.status).toBe(200)
      expect(await r.json()).toEqual({ proximo: "/conversa" })
      const perfil = await stores.profiles.ler(conta.id)
      expect(perfil.prakriti).toEqual({ vata: 0.5, pitta: 0.5 })
      expect(perfil.origem).toBe("declarado")
    })

    it("400 com lista vazia, repetida ou com três doshas", async () => {
      const { rotas } = await comConta({ aviso: true, evitar: true })
      for (const dosha of [[], ["vata", "vata"], ["vata", "pitta", "kapha"]]) {
        expect((await rotas.perfil(pedido({ dosha, cidade: null }))).status).toBe(400)
      }
    })

    it("adiado marca dosha_adiado_em e aponta para a conversa", async () => {
      const { rotas, stores, conta } = await comConta({ aviso: true, evitar: true })
      const r = await rotas.perfil(pedido({ dosha: "adiado", cidade: null }))
      expect(await r.json()).toEqual({ proximo: "/conversa" })
      expect((await stores.accounts.buscar(conta.id))?.dosha_adiado_em).toBe(AGORA)
    })

    it("quiz não grava nada e aponta para o quiz", async () => {
      const { rotas, stores, conta } = await comConta({ aviso: true, evitar: true })
      const r = await rotas.perfil(pedido({ dosha: "quiz", cidade: null }))
      expect(await r.json()).toEqual({ proximo: "/comecar/quiz" })
      expect((await stores.profiles.ler(conta.id)).prakriti).toBeNull()
      expect((await stores.accounts.buscar(conta.id))?.dosha_adiado_em).toBeNull()
    })

    it("grava a cidade quando ela vem", async () => {
      const { rotas, stores, conta } = await comConta({ aviso: true, evitar: true })
      const cidade = {
        nome: "Belo Horizonte",
        lat: -19.92,
        lon: -43.94,
        fuso: "America/Sao_Paulo",
      }
      const r = await rotas.perfil(pedido({ dosha: "adiado", cidade }))
      expect(r.status).toBe(200)
      const perfil = await stores.profiles.ler(conta.id)
      expect(perfil.cidade_nome).toBe("Belo Horizonte")
      expect(perfil.cidade_fuso).toBe("America/Sao_Paulo")
    })

    it("400 com fuso inválido, sem gravar a cidade", async () => {
      const { rotas, stores, conta } = await comConta({ aviso: true, evitar: true })
      const cidade = { nome: "Belo Horizonte", lat: -19.92, lon: -43.94, fuso: "Nao/Existe" }
      const r = await rotas.perfil(pedido({ dosha: "adiado", cidade }))
      expect(r.status).toBe(400)
      expect((await stores.profiles.ler(conta.id)).cidade_nome).toBeNull()
    })

    it("400 com latitude fora da faixa", async () => {
      const { rotas } = await comConta({ aviso: true, evitar: true })
      const cidade = { nome: "Longe", lat: 91, lon: 0, fuso: "America/Sao_Paulo" }
      expect((await rotas.perfil(pedido({ dosha: "adiado", cidade }))).status).toBe(400)
    })
  })

  describe("quiz", () => {
    it("quiz completo grava a prakriti pelo quiz e devolve o nome", async () => {
      const { rotas, stores, conta, kb } = await comConta({ aviso: true, evitar: true })
      const corpo = { respostas: respostasTodas(kb.quiz, "vata") }
      const r = await rotas.quiz(pedido(corpo))
      expect(r.status).toBe(200)
      expect(await r.json()).toEqual({
        nome: kb.doshas.find((d) => d.id === "vata")?.nome,
        doshas: ["vata"],
        dual: false,
      })
      const perfil = await stores.profiles.ler(conta.id)
      expect(perfil.prakriti).toEqual({ vata: 1, pitta: 0, kapha: 0 })
      expect(perfil.origem).toBe("quiz")
    })

    it("400 com pergunta faltando, repetida ou desconhecida, sem gravar", async () => {
      const { rotas, stores, conta, kb } = await comConta({ aviso: true, evitar: true })
      const todas = respostasTodas(kb.quiz, "vata")
      const repetida = [
        ...todas.slice(0, -1),
        { pergunta_id: todas[0]?.pergunta_id, dosha: "pitta" },
      ]
      const casos = [
        { respostas: [] },
        { respostas: todas.slice(1) },
        { respostas: repetida },
        { respostas: [{ pergunta_id: "nao-existe", dosha: "vata" }] },
      ]
      for (const corpo of casos) {
        expect((await rotas.quiz(pedido(corpo))).status).toBe(400)
      }
      expect((await stores.profiles.ler(conta.id)).prakriti).toBeNull()
    })
  })

  it("uma conta não muda o onboarding de outra", async () => {
    const { rotas, stores, extra } = await comConta({}, true)
    await rotas.aviso(pedido({}))
    expect(extra && (await stores.accounts.buscar(extra.id))?.aviso_aceito_em).toBeNull()
  })
})
