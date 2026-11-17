import { describe, expect, it, vi } from "vitest"
import type { DepsDaRota } from "@/app/_lib/rota"
import { type Container, createContainer } from "@/infra/container"
import { rotasDoVoce } from "./voce"

// Stores em memória (modo e2e) e a base real: a pasta de rotas não importa fakes.
const AGORA = "2026-03-10T15:00:00.000Z"
const DIA = "2026-03-10"
const UUID_DE_FORA = "7f0c9a4e-1b2d-4c3e-8f5a-6b7c8d9e0f1a"

function montar(container?: Container) {
  vi.stubEnv("RITU_MODO", "e2e")
  const base = container ?? createContainer({ clock: { now: () => new Date(AGORA) } })
  const deps = (contaId?: string, c: Container = base): DepsDaRota => ({
    contaDaSessao: async () => contaId,
    container: c,
  })
  return { container: base, stores: base.stores, deps }
}

async function comConta() {
  const m = montar()
  const conta = await m.stores.accounts.criar({ tipo: "google", google_sub: "s1", email: "a@b.c" })
  const outra = await m.stores.accounts.criar({ tipo: "google", google_sub: "s2" })
  const rotas = rotasDoVoce(m.deps(conta.id))
  return { ...m, conta, outra, rotas }
}

function pedido(corpo?: unknown, url = "http://x/api/perfil"): Request {
  return new Request(url, {
    method: "POST",
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
}

describe("rotasDoVoce", () => {
  it("401 sem sessão em todas as rotas", async () => {
    const m = montar()
    const rotas = rotasDoVoce(m.deps(undefined))
    const chamadas = [
      rotas.lerVoce(new Request("http://x/api/voce")),
      rotas.tocarPerfil(pedido({ acao: "cidade", cidade: null })),
      rotas.tocarMemoria(
        pedido({ acao: "falta_apagar", alimento_id: "leite" }, "http://x/api/memoria"),
      ),
    ]
    for (const resposta of await Promise.all(chamadas)) {
      expect(resposta.status).toBe(401)
      expect(await resposta.json()).toEqual({ erro: "sem_sessao" })
    }
  })

  describe("GET /api/voce", () => {
    it("devolve a visão da conta, sem nada de outra conta", async () => {
      const { rotas, stores, outra } = await comConta()
      await stores.pantry.registrar(outra.id, [{ alimento_id: "gengibre" }], "tela")
      const r = await rotas.lerVoce(new Request("http://x/api/voce"))
      expect(r.status).toBe(200)
      const corpo = await r.json()
      expect(corpo.voce.painel).toBeDefined()
      expect(corpo.voce.conta.tipo).toBe("google")
      expect(JSON.stringify(corpo)).not.toContain("Gengibre")
    })
  })

  describe("POST /api/perfil", () => {
    it("corpo fora do schema → 400 corpo_invalido", async () => {
      const { rotas } = await comConta()
      const r = await rotas.tocarPerfil(pedido({ acao: "inventar" }))
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "corpo_invalido" })
    })

    it("corpo grande → 413", async () => {
      const { rotas } = await comConta()
      const r = await rotas.tocarPerfil(
        pedido({ acao: "nao_come_acrescentar", texto: "a".repeat(200_000) }),
      )
      expect(r.status).toBe(413)
      expect(await r.json()).toEqual({ erro: "corpo_grande" })
    })

    it("evitar_tirar sem confirmado: true → 400 corpo_invalido", async () => {
      const { rotas } = await comConta()
      const r = await rotas.tocarPerfil(
        pedido({ acao: "evitar_tirar", item: { tipo: "texto", valor: "pimenta" } }),
      )
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "corpo_invalido" })
    })

    it("alimento fora da base → 400 toque_invalido", async () => {
      const { rotas } = await comConta()
      const r = await rotas.tocarPerfil(
        pedido({ acao: "nao_come_acrescentar", alimento_id: "nao-existe" }),
      )
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "toque_invalido" })
    })

    it("cidade devolve a visão e o nome", async () => {
      const { rotas } = await comConta()
      const r = await rotas.tocarPerfil(pedido({ acao: "cidade", cidade: null }))
      expect(r.status).toBe(200)
      const corpo = await r.json()
      expect(corpo.nome).toBe("")
      expect(corpo.voce.painel).toBeDefined()
      expect(corpo.resultado).toBeUndefined()
    })

    it("quiz completo devolve o resultado com nome, doshas e dual", async () => {
      const { rotas, container } = await comConta()
      const respostas = container.knowledge.quiz.map((p) => ({ pergunta_id: p.id, dosha: "vata" }))
      const r = await rotas.tocarPerfil(pedido({ acao: "quiz", respostas }))
      expect(r.status).toBe(200)
      const corpo = await r.json()
      expect(corpo.nome).toEqual(expect.any(String))
      expect(corpo.voce).toBeDefined()
      expect(corpo.resultado).toEqual({ nome: corpo.nome, doshas: ["vata"], dual: false })
    })

    it("quiz com respostas faltando → 400 corpo_invalido", async () => {
      const { rotas, container } = await comConta()
      const respostas = container.knowledge.quiz.slice(1).map((p) => ({
        pergunta_id: p.id,
        dosha: "vata",
      }))
      const r = await rotas.tocarPerfil(pedido({ acao: "quiz", respostas }))
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "corpo_invalido" })
    })
  })

  describe("POST /api/memoria", () => {
    const pedidoDeMemoria = (corpo?: unknown) => pedido(corpo, "http://x/api/memoria")

    it("corpo fora do schema → 400 corpo_invalido", async () => {
      const { rotas } = await comConta()
      const r = await rotas.tocarMemoria(pedidoDeMemoria({ acao: "inventar" }))
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "corpo_invalido" })
    })

    it("corpo grande → 413", async () => {
      const { rotas } = await comConta()
      const r = await rotas.tocarMemoria(
        pedidoDeMemoria({
          acao: "nota_corrigir",
          nota_id: UUID_DE_FORA,
          texto: "a".repeat(200_000),
        }),
      )
      expect(r.status).toBe(413)
      expect(await r.json()).toEqual({ erro: "corpo_grande" })
    })

    it("gosto devolve a visão e o nome da base", async () => {
      const { rotas } = await comConta()
      const r = await rotas.tocarMemoria(
        pedidoDeMemoria({ acao: "gosto", item_tipo: "alimento", item_id: "leite", gosto: "gosta" }),
      )
      expect(r.status).toBe(200)
      const corpo = await r.json()
      expect(corpo.nome).toBe("Leite")
      expect(corpo.voce.memoria).toBeDefined()
    })

    it("nota de outra conta → recusa e nada muda", async () => {
      const { rotas } = await comConta()
      const r = await rotas.tocarMemoria(
        pedidoDeMemoria({ acao: "nota_apagar", nota_id: UUID_DE_FORA }),
      )
      expect(r.status).toBe(400)
      expect(["toque_invalido", "nota_invalida"]).toContain((await r.json()).erro)
    })

    it("apagar a conversa de hoje com run aberto → 409 conversa_em_andamento", async () => {
      const { rotas, stores, conta } = await comConta()
      await stores.runs.criar(conta.id, { caminho: "acompanhante", intencoes: [], dia: DIA })
      const r = await rotas.tocarMemoria(pedidoDeMemoria({ acao: "conversa_apagar", dia: DIA }))
      expect(r.status).toBe(409)
      expect(await r.json()).toEqual({ erro: "conversa_em_andamento" })
    })
  })
})
