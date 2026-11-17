import { describe, expect, it, vi } from "vitest"
import type { DepsDaRota } from "@/app/_lib/rota"
import { type Container, createContainer } from "@/infra/container"
import { rotasDaCasa } from "./casa"

// Stores em memória (modo e2e) e a base real: a pasta de rotas não importa fakes.
const AGORA = "2026-03-10T15:00:00.000Z"
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
  const rotas = rotasDaCasa(m.deps(conta.id))
  return { ...m, conta, outra, rotas }
}

function pedido(corpo?: unknown, url = "http://x/api/casa"): Request {
  return new Request(url, {
    method: "POST",
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
}

const comId = (id: string) => ({ params: Promise.resolve({ id }) })

describe("rotasDaCasa", () => {
  it("401 sem sessão em todas as rotas", async () => {
    const m = montar()
    const rotas = rotasDaCasa(m.deps(undefined))
    const chamadas = [
      rotas.lerCasa(new Request("http://x/api/casa")),
      rotas.tocarCasa(pedido({ acao: "adicionar", alimento_id: "gengibre" })),
      rotas.preferencias(pedido({ alimento_id: "gengibre", gosto: "gosta" })),
      rotas.lista(pedido({ acao: "por", alimento_id: "gengibre" })),
      rotas.lerRetornos(new Request("http://x/api/retornos")),
      rotas.responderRetorno(pedido({ resultado: "ajudou" }), comId(UUID_DE_FORA)),
    ]
    for (const resposta of await Promise.all(chamadas)) {
      expect(resposta.status).toBe(401)
      expect(await resposta.json()).toEqual({ erro: "sem_sessao" })
    }
  })

  describe("GET /api/casa", () => {
    it("devolve a casa da conta", async () => {
      const { rotas } = await comConta()
      const r = await rotas.lerCasa(new Request("http://x/api/casa"))
      expect(r.status).toBe(200)
      const corpo = await r.json()
      expect(corpo.casa.vazia).toBe(true)
      expect(corpo.casa.ainda_tem).toEqual([])
    })
  })

  describe("POST /api/casa", () => {
    it("corpo fora do schema → 400 corpo_invalido", async () => {
      const { rotas } = await comConta()
      const r = await rotas.tocarCasa(pedido({ acao: "inventar" }))
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "corpo_invalido" })
    })

    it("corpo grande → 413", async () => {
      const { rotas } = await comConta()
      const r = await rotas.tocarCasa(
        pedido({ acao: "adicionar_texto", texto: "a".repeat(200_000) }),
      )
      expect(r.status).toBe(413)
      expect(await r.json()).toEqual({ erro: "corpo_grande" })
    })

    it("item de outra conta → 400 toque_invalido", async () => {
      const { rotas, stores, outra } = await comConta()
      await stores.pantry.registrar(outra.id, [{ alimento_id: "gengibre" }], "tela")
      const [item] = await stores.pantry.listar(outra.id)
      const r = await rotas.tocarCasa(pedido({ acao: "tirar", item_id: item?.id }))
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "toque_invalido" })
    })

    it("adicionar devolve a casa com o item e o nome da base", async () => {
      const { rotas } = await comConta()
      const r = await rotas.tocarCasa(pedido({ acao: "adicionar", alimento_id: "gengibre" }))
      expect(r.status).toBe(200)
      const corpo = await r.json()
      expect(corpo.nome).toBe("Gengibre")
      expect(corpo.casa.vazia).toBe(false)
      const naPrateleira = corpo.casa.prateleiras.flatMap(
        (p: { itens: { alimento_id: string }[] }) => p.itens,
      )
      expect(naPrateleira.map((i: { alimento_id: string }) => i.alimento_id)).toContain("gengibre")
    })

    it('"acabou" devolve a casa com o item em acabou', async () => {
      const { rotas, stores, conta } = await comConta()
      await stores.pantry.registrar(conta.id, [{ alimento_id: "gengibre" }], "tela")
      const [item] = await stores.pantry.listar(conta.id)
      const r = await rotas.tocarCasa(pedido({ acao: "acabou", item_id: item?.id }))
      expect(r.status).toBe(200)
      const corpo = await r.json()
      expect(corpo.casa.acabou.map((i: { alimento_id: string }) => i.alimento_id)).toContain(
        "gengibre",
      )
    })
  })

  describe("POST /api/preferencias", () => {
    it("grava o gosto e devolve a casa e o nome da base", async () => {
      const { rotas } = await comConta()
      const r = await rotas.preferencias(pedido({ alimento_id: "gengibre", gosto: "gosta" }))
      expect(r.status).toBe(200)
      const corpo = await r.json()
      expect(corpo.nome).toBe("Gengibre")
      expect(corpo.casa).toBeDefined()
    })

    it("alimento fora da base → 400 toque_invalido", async () => {
      const { rotas } = await comConta()
      const r = await rotas.preferencias(pedido({ alimento_id: "nao-existe", gosto: "gosta" }))
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "toque_invalido" })
    })

    it("gosto fora do enum → 400 corpo_invalido", async () => {
      const { rotas } = await comConta()
      const r = await rotas.preferencias(pedido({ alimento_id: "gengibre", gosto: "talvez" }))
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "corpo_invalido" })
    })
  })

  describe("POST /api/lista", () => {
    it("põe na lista e devolve a casa com o item", async () => {
      const { rotas } = await comConta()
      const r = await rotas.lista(pedido({ acao: "por", alimento_id: "gengibre" }))
      expect(r.status).toBe(200)
      const corpo = await r.json()
      expect(corpo.nome).toBe("Gengibre")
      expect(corpo.casa.lista.map((i: { alimento_id: string }) => i.alimento_id)).toContain(
        "gengibre",
      )
    })

    it("alimento fora da base → 400 toque_invalido", async () => {
      const { rotas } = await comConta()
      const r = await rotas.lista(pedido({ acao: "por", alimento_id: "nao-existe" }))
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "toque_invalido" })
    })
  })

  describe("retornos", () => {
    async function comRetorno() {
      const m = await comConta()
      const [retorno] = await m.stores.outcomes.criar(m.conta.id, "run1", [
        {
          tipo: "cha",
          pratica_id: "cha-gengibre",
          alimentos: ["gengibre", "canela"],
          titulo: "Chá de gengibre",
        },
      ])
      if (!retorno) throw new Error("retorno não criado")
      return { ...m, retorno }
    }

    it("GET devolve o como ficou com os pendentes", async () => {
      const { rotas, retorno } = await comRetorno()
      const r = await rotas.lerRetornos(new Request("http://x/api/retornos"))
      expect(r.status).toBe(200)
      const corpo = await r.json()
      expect(corpo.comoFicou.total).toBe(1)
      expect(corpo.comoFicou.dias[0].retornos[0].id).toBe(retorno.id)
    })

    it("POST responde o retorno e devolve os pendentes restantes", async () => {
      const { rotas, retorno } = await comRetorno()
      const r = await rotas.responderRetorno(pedido({ resultado: "ajudou" }), comId(retorno.id))
      expect(r.status).toBe(200)
      const corpo = await r.json()
      expect(corpo.retorno.resultado).toBe("ajudou")
      expect(corpo.retorno.status).toBe("respondido")
      expect(corpo.pendentes).toBe(0)
    })

    it(":id que não é uuid → 400 toque_invalido", async () => {
      const { rotas } = await comRetorno()
      const r = await rotas.responderRetorno(pedido({ resultado: "ajudou" }), comId("nao-uuid"))
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "toque_invalido" })
    })

    it("resultado fora do enum → 400 corpo_invalido", async () => {
      const { rotas, retorno } = await comRetorno()
      const r = await rotas.responderRetorno(pedido({ resultado: "talvez" }), comId(retorno.id))
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "corpo_invalido" })
    })

    it("retorno respondido duas vezes devolve o primeiro resultado", async () => {
      const { rotas, retorno } = await comRetorno()
      await rotas.responderRetorno(pedido({ resultado: "ajudou" }), comId(retorno.id))
      const r = await rotas.responderRetorno(pedido({ resultado: "nao_ajudou" }), comId(retorno.id))
      expect(r.status).toBe(200)
      const corpo = await r.json()
      expect(corpo.retorno.resultado).toBe("ajudou")
    })
  })
})
