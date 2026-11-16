import { beforeEach, describe, expect, it } from "vitest"
import type { Retorno, SugestaoRegistrada } from "@/core/outcomes/ports"
import type { Stores } from "@/core/stores"
import { type ContractEnv, criarDuasContas } from "./env"

const DIA = "2026-01-15"
const UM_MINUTO = 60_000
const UM_DIA = 86_400_000

const sugestao = (titulo: string): SugestaoRegistrada => ({
  tipo: "cha",
  alimentos: ["gengibre"],
  titulo,
})

async function criarRun(stores: Stores, contaId: string): Promise<string> {
  const run = await stores.runs.criar(contaId, { caminho: "casa", intencoes: [], dia: DIA })
  return run.id
}

async function criarRetorno(
  stores: Stores,
  contaId: string,
  runId: string,
  titulo: string,
): Promise<Retorno> {
  const [retorno] = await stores.outcomes.criar(contaId, runId, [sugestao(titulo)])
  if (!retorno) throw new Error("retorno não criado")
  return retorno
}

export function outcomesContract(make: () => Promise<ContractEnv> | ContractEnv): void {
  describe("contrato: OutcomeStore", () => {
    let env: ContractEnv

    beforeEach(async () => {
      env = await make()
      await env.reset?.()
    })

    it("criar grava o retorno como aguardando e devolve o registro", async () => {
      const { a } = await criarDuasContas(env.stores)
      const runId = await criarRun(env.stores, a)
      const retorno = await criarRetorno(env.stores, a, runId, "Chá de gengibre")

      expect(retorno).toMatchObject({
        conta_id: a,
        run_id: runId,
        status: "aguardando",
        resultado: null,
        origem: null,
        respondido_em: null,
        sugestao: { tipo: "cha", titulo: "Chá de gengibre" },
      })
    })

    it("criar recusa sugestão fora do schema e não grava nada", async () => {
      const { a } = await criarDuasContas(env.stores)
      const runId = await criarRun(env.stores, a)
      const invalida = {
        tipo: "bebida",
        alimentos: [],
        titulo: "x",
      } as unknown as SugestaoRegistrada

      await expect(env.stores.outcomes.criar(a, runId, [invalida])).rejects.toThrow()
      expect(await env.stores.outcomes.pendentes(a)).toEqual([])
    })

    it("pendentes devolve os aguardando, o mais recente primeiro", async () => {
      const { a } = await criarDuasContas(env.stores)
      const runId = await criarRun(env.stores, a)
      const antigo = await criarRetorno(env.stores, a, runId, "antigo")
      env.clock.advance(UM_MINUTO)
      const novo = await criarRetorno(env.stores, a, runId, "novo")

      const pendentes = await env.stores.outcomes.pendentes(a)
      expect(pendentes.map((r) => r.id)).toEqual([novo.id, antigo.id])
    })

    it("responder grava resultado, origem e respondido_em, e tira o retorno dos pendentes", async () => {
      const { a } = await criarDuasContas(env.stores)
      const runId = await criarRun(env.stores, a)
      const retorno = await criarRetorno(env.stores, a, runId, "chá")

      const respondido = await env.stores.outcomes.responder(a, retorno.id, "ajudou", "toque")

      expect(respondido?.mudou).toBe(true)
      expect(respondido?.retorno).toMatchObject({
        status: "respondido",
        resultado: "ajudou",
        origem: "toque",
        respondido_em: "2026-01-15T12:00:00.000Z",
      })
      expect(await env.stores.outcomes.pendentes(a)).toEqual([])
    })

    it("responder em retorno já respondido devolve o estado atual e não muda nada", async () => {
      const { a } = await criarDuasContas(env.stores)
      const runId = await criarRun(env.stores, a)
      const retorno = await criarRetorno(env.stores, a, runId, "chá")
      await env.stores.outcomes.responder(a, retorno.id, "ajudou", "toque")
      env.clock.advance(UM_MINUTO)

      const de_novo = await env.stores.outcomes.responder(a, retorno.id, "nao_ajudou", "conversa")

      expect(de_novo?.mudou).toBe(false)
      expect(de_novo?.retorno).toMatchObject({
        resultado: "ajudou",
        origem: "toque",
        respondido_em: "2026-01-15T12:00:00.000Z",
      })
    })

    it("responder em retorno inexistente devolve undefined", async () => {
      const { a } = await criarDuasContas(env.stores)
      const resposta = await env.stores.outcomes.responder(
        a,
        crypto.randomUUID(),
        "ajudou",
        "toque",
      )
      expect(resposta).toBeUndefined()
    })

    it("atualizarSugestao troca a sugestão de um retorno aguardando e os pendentes passam a trazer a nova", async () => {
      const { a } = await criarDuasContas(env.stores)
      const runId = await criarRun(env.stores, a)
      const retorno = await criarRetorno(env.stores, a, runId, "chá antigo")

      const trocado = await env.stores.outcomes.atualizarSugestao(
        a,
        retorno.id,
        sugestao("chá novo"),
      )

      expect(trocado).toMatchObject({
        id: retorno.id,
        status: "aguardando",
        sugestao: { tipo: "cha", titulo: "chá novo" },
      })
      const pendentes = await env.stores.outcomes.pendentes(a)
      expect(pendentes).toMatchObject([{ id: retorno.id, sugestao: { titulo: "chá novo" } }])
    })

    it("atualizarSugestao em retorno já respondido devolve undefined e não troca a sugestão", async () => {
      const { a } = await criarDuasContas(env.stores)
      const runId = await criarRun(env.stores, a)
      const retorno = await criarRetorno(env.stores, a, runId, "chá antigo")
      await env.stores.outcomes.responder(a, retorno.id, "ajudou", "toque")

      const trocado = await env.stores.outcomes.atualizarSugestao(
        a,
        retorno.id,
        sugestao("chá novo"),
      )

      expect(trocado).toBeUndefined()
      const doRun = await env.stores.outcomes.doRun(a, runId)
      expect(doRun).toMatchObject([
        { id: retorno.id, status: "respondido", sugestao: { titulo: "chá antigo" } },
      ])
    })

    it("atualizarSugestao de outra conta devolve undefined e não muda o retorno da conta A", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      const runId = await criarRun(env.stores, a)
      const retorno = await criarRetorno(env.stores, a, runId, "chá antigo")

      const trocado = await env.stores.outcomes.atualizarSugestao(
        b,
        retorno.id,
        sugestao("chá invadido"),
      )

      expect(trocado).toBeUndefined()
      expect(await env.stores.outcomes.pendentes(a)).toMatchObject([
        { id: retorno.id, sugestao: { titulo: "chá antigo" } },
      ])
    })

    it("atualizarSugestao recusa sugestão fora do schema e não grava nada", async () => {
      const { a } = await criarDuasContas(env.stores)
      const runId = await criarRun(env.stores, a)
      const retorno = await criarRetorno(env.stores, a, runId, "chá antigo")
      const invalida = {
        tipo: "bebida",
        alimentos: [],
        titulo: "x",
      } as unknown as SugestaoRegistrada

      await expect(env.stores.outcomes.atualizarSugestao(a, retorno.id, invalida)).rejects.toThrow()
      expect(await env.stores.outcomes.pendentes(a)).toMatchObject([
        { id: retorno.id, sugestao: { titulo: "chá antigo" } },
      ])
    })

    it("doRun devolve os retornos do run da conta", async () => {
      const { a } = await criarDuasContas(env.stores)
      const runId = await criarRun(env.stores, a)
      const primeiro = await criarRetorno(env.stores, a, runId, "um")
      const segundo = await criarRetorno(env.stores, a, runId, "dois")

      const doRun = await env.stores.outcomes.doRun(a, runId)
      expect(doRun.map((r) => r.id).sort()).toEqual([primeiro.id, segundo.id].sort())
    })

    it("apagarAguardandoAntesDe apaga só os aguardando mais antigos que o limite e devolve a contagem", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { outcomes } = env.stores
      const runId = await criarRun(env.stores, a)
      const velho = await criarRetorno(env.stores, a, runId, "velho")
      const respondido = await criarRetorno(env.stores, a, runId, "respondido")
      await outcomes.responder(a, respondido.id, "ajudou", "toque")

      env.clock.advance(8 * UM_DIA)
      const recente = await criarRetorno(env.stores, a, runId, "recente")
      const limite = new Date(env.clock.now().getTime() - UM_DIA)

      expect(await outcomes.apagarAguardandoAntesDe(limite)).toBe(1)
      expect((await outcomes.pendentes(a)).map((r) => r.id)).toEqual([recente.id])
      expect(await outcomes.responder(a, velho.id, "ajudou", "toque")).toBeUndefined()
      expect(await outcomes.responder(a, respondido.id, "nao_ajudou", "toque")).toMatchObject({
        mudou: false,
        retorno: { resultado: "ajudou" },
      })
    })

    it("conta B não lê, responde nem altera os retornos da conta A", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      const { outcomes } = env.stores
      const runId = await criarRun(env.stores, a)
      const retorno = await criarRetorno(env.stores, a, runId, "chá")

      expect(await outcomes.pendentes(b)).toEqual([])
      expect(await outcomes.doRun(b, runId)).toEqual([])
      expect(await outcomes.responder(b, retorno.id, "ajudou", "toque")).toBeUndefined()
      expect(await outcomes.pendentes(a)).toMatchObject([
        { id: retorno.id, status: "aguardando", resultado: null },
      ])
    })
  })
}
