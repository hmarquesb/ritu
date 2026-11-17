import { describe, expect, it, vi } from "vitest"
import type { DepsDaRota } from "@/app/_lib/rota"
import { type Container, createContainer } from "@/infra/container"
import { rotasDaConversa } from "./conversa"

// Stores em memória (modo e2e) e a base real: a pasta de rotas não importa fakes.
const AGORA = "2026-03-10T15:00:00.000Z"
const DIA = "2026-03-10"
const UUID_DE_FORA = "7f0c9a4e-1b2d-4c3e-8f5a-6b7c8d9e0f1a"

function montar(container?: Container) {
  vi.stubEnv("RITU_MODO", "e2e")
  const base = container ?? createContainer({ clock: { now: () => new Date(AGORA) } })
  const deps = (contaId?: string, c: Container = base): DepsDaRota => ({
    contaDaSessao: async () => contaId,
    quemPede: () => ({ ipHash: "h" }),
    container: c,
  })
  return { container: base, stores: base.stores, deps }
}

async function comConta() {
  const m = montar()
  const conta = await m.stores.accounts.criar({ tipo: "google", google_sub: "s1", email: "a@b.c" })
  const outra = await m.stores.accounts.criar({ tipo: "google", google_sub: "s2" })
  const run = await m.stores.runs.criar(conta.id, {
    caminho: "acompanhante",
    intencoes: [],
    dia: DIA,
  })
  const rotas = rotasDaConversa(m.deps(conta.id))
  return { ...m, conta, outra, run, rotas, deps: m.deps }
}

function pedido(corpo?: unknown): Request {
  return new Request("http://x/api/runs", {
    method: "POST",
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
}

const noRun = (id: string) => ({ params: Promise.resolve({ id }) })

describe("rotasDaConversa", () => {
  it("401 sem sessão em todas as rotas", async () => {
    const m = montar()
    const rotas = rotasDaConversa(m.deps(undefined))
    const id = UUID_DE_FORA
    const chamadas = [
      rotas.conversa(new Request("http://x/api/conversa")),
      rotas.run(new Request("http://x/api/runs/x"), noRun(id)),
      rotas.aprovacao(pedido({ aprovadas: [] }), noRun(id)),
      rotas.troca(pedido({ sugestao: 0, alimento_id: "gengibre", motivo: "trocar" }), noRun(id)),
      rotas.respostaDaTroca(
        pedido({ sugestao: 0, alimento_id: "gengibre", candidato: "canela", resposta: "tenho" }),
        noRun(id),
      ),
      rotas.voto(pedido({ voto: "up" }), noRun(id)),
    ]
    for (const resposta of await Promise.all(chamadas)) {
      expect(resposta.status).toBe(401)
      expect(await resposta.json()).toEqual({ erro: "sem_sessao" })
    }
  })

  describe("GET /api/conversa", () => {
    it("devolve a conversa do dia da conta", async () => {
      const { rotas } = await comConta()
      const r = await rotas.conversa(new Request("http://x/api/conversa"))
      expect(r.status).toBe(200)
      const corpo = await r.json()
      expect(corpo.falas).toEqual([])
      expect(corpo.pendentes).toBe(0)
    })
  })

  describe("GET /api/runs/:id", () => {
    it("devolve a visão e os pendentes do run da conta", async () => {
      const { rotas, run } = await comConta()
      const r = await rotas.run(new Request("http://x/api/runs/x"), noRun(run.id))
      expect(r.status).toBe(200)
      const corpo = await r.json()
      expect(corpo.visao.run_id).toBe(run.id)
      expect(corpo.pendentes).toBe(0)
    })

    it("404 para id que não é uuid", async () => {
      const { rotas } = await comConta()
      const r = await rotas.run(new Request("http://x/api/runs/x"), noRun("nao-e-uuid"))
      expect(r.status).toBe(404)
      expect(await r.json()).toEqual({ erro: "run_nao_encontrado" })
    })

    it("404 para run de outra conta, sem gravar nada", async () => {
      const { deps, conta, outra, stores, run } = await comConta()
      const rotasDaOutra = rotasDaConversa(deps(outra.id))
      const r = await rotasDaOutra.voto(pedido({ voto: "up" }), noRun(run.id))
      expect(r.status).toBe(404)
      expect(await r.json()).toEqual({ erro: "run_nao_encontrado" })
      expect((await stores.runs.votos(conta.id, [run.id]))[run.id]).toBeUndefined()
    })
  })

  describe("POST /api/runs/:id/aprovacao", () => {
    it("aprovação parcial deixa o bloco anotado", async () => {
      const { rotas, stores, conta, run } = await comConta()
      const [aprovada, recusada] = await stores.proposals.criar(conta.id, run.id, [
        {
          tool: "casa.propor",
          conteudo: { acao: "tem", itens: [{ alimento_id: "gengibre", nome: "gengibre" }] },
        },
        {
          tool: "casa.propor",
          conteudo: { acao: "tem", itens: [{ alimento_id: "canela", nome: "canela" }] },
        },
      ])
      const propostas = [
        { id: aprovada?.id, tool: "casa.propor", texto: "Tem gengibre" },
        { id: recusada?.id, tool: "casa.propor", texto: "Tem canela" },
      ]
      await stores.runs.atualizar(conta.id, run.id, {
        status: "waiting_for_approval",
        saida: {
          origem: "codigo",
          resposta: "Anotei",
          geral: false,
          avisos: [],
          explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
          sugestoes: [],
          evitar: [],
          incertos: [],
          citados: [],
          anotacoes: [],
          propostas,
        },
        pendencia: {
          tipo: "aprovacao",
          criada_em: AGORA,
          conteudo: { propostas: [aprovada?.id, recusada?.id] },
        },
      })
      const r = await rotas.aprovacao(pedido({ aprovadas: [aprovada?.id] }), noRun(run.id))
      expect(r.status).toBe(200)
      const corpo = await r.json()
      expect(corpo.visao.bloco.estado).toBe("anotado")
    })

    it("run que não espera aprovação é 409 run_nao_continuavel", async () => {
      const { rotas, run } = await comConta()
      const r = await rotas.aprovacao(pedido({ aprovadas: [] }), noRun(run.id))
      expect(r.status).toBe(409)
      expect(await r.json()).toEqual({ erro: "run_nao_continuavel" })
    })

    it("400 com linha repetida", async () => {
      const { rotas, run } = await comConta()
      const r = await rotas.aprovacao(pedido({ aprovadas: ["a", "a"] }), noRun(run.id))
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "aprovacao_invalida" })
    })

    it("400 aprovacao_invalida com mais linhas que o máximo", async () => {
      const { rotas, run, container } = await comConta()
      const linhas = Array.from(
        { length: container.config.aprovacao.maxLinhas + 1 },
        (_, i) => `linha-${i}`,
      )
      const r = await rotas.aprovacao(pedido({ aprovadas: linhas }), noRun(run.id))
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "aprovacao_invalida" })
    })

    it("400 com corpo inválido", async () => {
      const { rotas, run } = await comConta()
      const r = await rotas.aprovacao(pedido({ aprovadas: "nao" }), noRun(run.id))
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "corpo_invalido" })
    })
  })

  describe("troca e resposta da troca", () => {
    const trocou = {
      resultado: "trocou" as const,
      sugestao: {
        tipo: "cha" as const,
        titulo: "Chá",
        como_fazer: "Ferva",
        itens: [],
        verbos: [],
        motivo: "m",
        linhas_base: [],
        novidade: false,
      },
    }

    async function comTouches(touches: Partial<Container["touches"]>) {
      const m = montar()
      const conta = await m.stores.accounts.criar({ tipo: "google", google_sub: "s1" })
      const run = await m.stores.runs.criar(conta.id, {
        caminho: "acompanhante",
        intencoes: [],
        dia: DIA,
      })
      const c = { ...m.container, touches: { ...m.container.touches, ...touches } }
      return { rotas: rotasDaConversa(m.deps(conta.id, c)), run }
    }

    it("troca devolve o resultado e a visão", async () => {
      const { rotas, run } = await comTouches({
        trocarIngrediente: async () => trocou,
      })
      const r = await rotas.troca(
        pedido({ sugestao: 0, alimento_id: "gengibre", motivo: "trocar" }),
        noRun(run.id),
      )
      expect(r.status).toBe(200)
      const corpo = await r.json()
      expect(corpo.resultado.resultado).toBe("trocou")
      expect(corpo.visao.run_id).toBe(run.id)
    })

    it("resposta da troca devolve o resultado e a visão", async () => {
      const { rotas, run } = await comTouches({
        responderTroca: async () => ({ resultado: "sem_substituto", texto: "Sem substituto" }),
      })
      const r = await rotas.respostaDaTroca(
        pedido({ sugestao: 0, alimento_id: "gengibre", candidato: "canela", resposta: "tenho" }),
        noRun(run.id),
      )
      expect(r.status).toBe(200)
      const corpo = await r.json()
      expect(corpo.resultado.resultado).toBe("sem_substituto")
      expect(corpo.visao.run_id).toBe(run.id)
    })

    it("400 com motivo desconhecido", async () => {
      const { rotas, run } = await comTouches({})
      const r = await rotas.troca(
        pedido({ sugestao: 0, alimento_id: "gengibre", motivo: "outro" }),
        noRun(run.id),
      )
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "corpo_invalido" })
    })
  })

  describe("POST /api/runs/:id/voto", () => {
    it("grava o voto e troca ao mudar", async () => {
      const { rotas, stores, conta, run } = await comConta()
      await stores.runs.atualizar(conta.id, run.id, { saida: { resposta: "Oi" } })
      const primeiro = await rotas.voto(pedido({ voto: "up" }), noRun(run.id))
      expect(primeiro.status).toBe(200)
      expect(await primeiro.json()).toEqual({ voto: "up" })
      const segundo = await rotas.voto(pedido({ voto: "down" }), noRun(run.id))
      expect(await segundo.json()).toEqual({ voto: "down" })
      expect((await stores.runs.votos(conta.id, [run.id]))[run.id]).toBe("down")
    })

    it("400 com voto fora da lista", async () => {
      const { rotas, run } = await comConta()
      const r = await rotas.voto(pedido({ voto: "talvez" }), noRun(run.id))
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ erro: "corpo_invalido" })
    })
  })
})
