import { beforeEach, describe, expect, it } from "vitest"
import type { Momento } from "@/core/memory-schemas"
import { RunAbertoError } from "@/core/runs/errors"
import type { NovaEtapa, StatusRun } from "@/core/runs/ports"
import type { Stores } from "@/core/stores"
import { type ContractEnv, criarDuasContas } from "./env"

const DIA = "2026-01-15"
const UMA_HORA = 3_600_000
const UM_DIA = 86_400_000

const MOMENTO: Momento = {
  estados: ["com_frio"],
  momento_do_dia: "manha",
  gunas_buscadas: ["quente"],
}

const etapa = (nome: string): NovaEtapa => ({
  tipo: "tool",
  nome,
  resumo: null,
  status: "ok",
  duracao_ms: 10,
  modelo: null,
  tokens_entrada: 0,
  tokens_saida: 0,
})

const abrir = (stores: Stores, contaId: string, trace_id?: string) =>
  stores.runs.criar(contaId, { caminho: "casa", intencoes: ["casa.ler"], dia: DIA, trace_id })

export function runsContract(make: () => Promise<ContractEnv> | ContractEnv): void {
  describe("contrato: RunRepository", () => {
    let env: ContractEnv

    beforeEach(async () => {
      env = await make()
      await env.reset?.()
    })

    it("criar devolve o run em running com os padrões e contadores zerados", async () => {
      const { a } = await criarDuasContas(env.stores)
      const run = await abrir(env.stores, a, "trace-1")

      expect(run).toMatchObject({
        conta_id: a,
        caminho: "casa",
        intencoes: ["casa.ler"],
        status: "running",
        checkpoint: null,
        pendencia: null,
        momento: null,
        com_incomodo: false,
        clima_usado: null,
        saida: null,
        passos: 0,
        tokens_entrada: 0,
        tokens_saida: 0,
        latencia_ms: 0,
        modelos: {},
        trocas_de_modelo: 0,
        prompt_versao: null,
        juiz_tentativas: 0,
        juiz_aprovado: null,
        trace_id: "trace-1",
        dia: DIA,
        criado_em: "2026-01-15T12:00:00.000Z",
      })
    })

    it("mudarStatusSe troca quando o status bate e devolve true", async () => {
      const { a } = await criarDuasContas(env.stores)
      const run = await abrir(env.stores, a)
      await env.stores.runs.atualizar(a, run.id, { status: "waiting_for_input" })

      expect(await env.stores.runs.mudarStatusSe(a, run.id, "waiting_for_input", "running")).toBe(
        true,
      )
      expect((await env.stores.runs.buscar(a, run.id))?.status).toBe("running")
    })

    it("mudarStatusSe com status diferente devolve false e não muda", async () => {
      const { a } = await criarDuasContas(env.stores)
      const run = await abrir(env.stores, a)

      expect(await env.stores.runs.mudarStatusSe(a, run.id, "waiting_for_input", "done")).toBe(
        false,
      )
      expect((await env.stores.runs.buscar(a, run.id))?.status).toBe("running")
    })

    it("mudarStatusSe de outra conta devolve false e não muda", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      const run = await abrir(env.stores, a)

      expect(await env.stores.runs.mudarStatusSe(b, run.id, "running", "done")).toBe(false)
      expect((await env.stores.runs.buscar(a, run.id))?.status).toBe("running")
    })

    it("mudarStatusSe duas vezes seguidas: só a primeira devolve true", async () => {
      const { a } = await criarDuasContas(env.stores)
      const run = await abrir(env.stores, a)
      await env.stores.runs.atualizar(a, run.id, { status: "waiting_for_input" })

      const primeira = await env.stores.runs.mudarStatusSe(
        a,
        run.id,
        "waiting_for_input",
        "running",
      )
      const segunda = await env.stores.runs.mudarStatusSe(a, run.id, "waiting_for_input", "running")
      expect([primeira, segunda]).toEqual([true, false])
    })

    it.each(["running", "waiting_for_input", "waiting_for_approval"] as const)(
      "criar com outro run em %s na conta lança RunAbertoError",
      async (status: StatusRun) => {
        const { a } = await criarDuasContas(env.stores)
        const primeiro = await abrir(env.stores, a)
        await env.stores.runs.atualizar(a, primeiro.id, { status })

        await expect(abrir(env.stores, a)).rejects.toBeInstanceOf(RunAbertoError)
      },
    )

    it("criar aceita um novo run depois que o anterior terminou", async () => {
      const { a } = await criarDuasContas(env.stores)
      const primeiro = await abrir(env.stores, a)
      await env.stores.runs.atualizar(a, primeiro.id, { status: "done" })

      await expect(abrir(env.stores, a)).resolves.toMatchObject({ status: "running" })
    })

    it("aberto devolve o run em andamento da conta e undefined quando não há nenhum", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { runs } = env.stores
      expect(await runs.aberto(a)).toBeUndefined()

      const run = await abrir(env.stores, a)
      expect(await runs.aberto(a)).toMatchObject({ id: run.id })

      await runs.atualizar(a, run.id, { status: "done" })
      expect(await runs.aberto(a)).toBeUndefined()
    })

    it("atualizar grava os campos e valida o momento com o schema", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { runs } = env.stores
      const run = await abrir(env.stores, a)

      await runs.atualizar(a, run.id, { status: "waiting_for_input", passos: 2, momento: MOMENTO })
      expect(await runs.buscar(a, run.id)).toMatchObject({
        status: "waiting_for_input",
        passos: 2,
        momento: MOMENTO,
      })

      const comIncomodo = { ...MOMENTO, incomodo: "dor de cabeça" } as unknown as Momento
      await expect(runs.atualizar(a, run.id, { momento: comIncomodo })).rejects.toThrow()
      expect(await runs.buscar(a, run.id)).toMatchObject({ momento: MOMENTO })
    })

    it("acrescentarEtapa numera em sequência e etapas devolve na ordem", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { runs } = env.stores
      const run = await abrir(env.stores, a)

      const primeira = await runs.acrescentarEtapa(a, run.id, etapa("buscar_clima"))
      const segunda = await runs.acrescentarEtapa(a, run.id, etapa("montar_resposta"))

      expect(segunda.ordem).toBe(primeira.ordem + 1)
      expect((await runs.etapas(a, run.id)).map((e) => e.nome)).toEqual([
        "buscar_clima",
        "montar_resposta",
      ])
    })

    it("recentes devolve só os done desde a data, os mais novos primeiro, até o limite", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { runs } = env.stores
      const t0 = env.clock.now()

      const r1 = await abrir(env.stores, a)
      await runs.atualizar(a, r1.id, { status: "done" })
      env.clock.advance(UM_DIA)
      const r2 = await abrir(env.stores, a)
      await runs.atualizar(a, r2.id, { status: "done" })
      env.clock.advance(UM_DIA)
      const r3 = await abrir(env.stores, a)
      await runs.atualizar(a, r3.id, { status: "failed" })

      expect((await runs.recentes(a, t0, 10)).map((r) => r.id)).toEqual([r2.id, r1.id])
      expect(
        (await runs.recentes(a, new Date(t0.getTime() + UM_DIA), 10)).map((r) => r.id),
      ).toEqual([r2.id])
      expect((await runs.recentes(a, t0, 1)).map((r) => r.id)).toEqual([r2.id])
    })

    it("contarMensagensDoDia conta só as mensagens da pessoa no dia", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { messages, runs } = env.stores
      const gravar = (autor: "pessoa" | "agente", dia: string) =>
        messages.gravar(a, { autor, texto: "x", com_incomodo: false, dia })
      await gravar("pessoa", DIA)
      await gravar("pessoa", DIA)
      await gravar("agente", DIA)
      await gravar("pessoa", "2026-01-14")

      expect(await runs.contarMensagensDoDia(a, DIA)).toBe(2)
    })

    it("votar devolve o voto anterior: null na primeira vez, depois o que estava gravado", async () => {
      const { a } = await criarDuasContas(env.stores)
      const run = await abrir(env.stores, a)

      await expect(env.stores.runs.votar(a, run.id, "up")).resolves.toBeNull()
      await expect(env.stores.runs.votar(a, run.id, "down")).resolves.toBe("up")
      await expect(env.stores.runs.votar(a, run.id, "down")).resolves.toBe("down")
    })

    it("votar de outra conta devolve null e não grava nada", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      const run = await abrir(env.stores, a)

      await expect(env.stores.runs.votar(b, run.id, "down")).resolves.toBeNull()
      await expect(env.stores.runs.votar(a, run.id, "up")).resolves.toBeNull()
    })

    it("expirarEmEsperaAntesDe expira os runs em espera com atualizado_em antes do limite e devolve os ids", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      const { runs } = env.stores
      const ra = await abrir(env.stores, a)
      await runs.atualizar(a, ra.id, { status: "waiting_for_input" })

      env.clock.advance(UMA_HORA)
      const rb = await abrir(env.stores, b)
      // atualizado_em igual ao limite: o corte é estrito, então este não expira
      await runs.atualizar(b, rb.id, { status: "waiting_for_approval" })

      const expirados = await runs.expirarEmEsperaAntesDe(env.clock.now())

      expect(expirados).toEqual([ra.id])
      expect(await runs.buscar(a, ra.id)).toMatchObject({ status: "expired" })
      expect(await runs.buscar(b, rb.id)).toMatchObject({ status: "waiting_for_approval" })
    })

    it("conta B não lê nem altera os runs da conta A", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      const { runs } = env.stores
      const run = await abrir(env.stores, a)
      await runs.acrescentarEtapa(a, run.id, etapa("buscar_clima"))

      expect(await runs.buscar(b, run.id)).toBeUndefined()
      expect(await runs.aberto(b)).toBeUndefined()
      expect(await runs.etapas(b, run.id)).toEqual([])
      expect(await runs.recentes(b, new Date(0), 10)).toEqual([])
      expect(await runs.contarMensagensDoDia(b, DIA)).toBe(0)
      await runs.atualizar(b, run.id, { status: "done" })
      await runs.votar(b, run.id, "up")
      await runs.acrescentarEtapa(b, run.id, etapa("intrusa")).catch(() => undefined)

      expect(await runs.buscar(a, run.id)).toMatchObject({ status: "running" })
      expect((await runs.etapas(a, run.id)).map((e) => e.nome)).toEqual(["buscar_clima"])
    })

    it("contasComRunDesde traz cada conta uma vez, só com run done criado a partir da data", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      const { runs } = env.stores
      const encerrar = async (contaId: string, status: StatusRun) => {
        const run = await abrir(env.stores, contaId)
        await runs.atualizar(contaId, run.id, { status })
      }
      await encerrar(b, "done")
      env.clock.advance(UM_DIA)
      const desde = env.clock.now()

      await encerrar(a, "done")
      await encerrar(a, "done")
      await encerrar(b, "failed")
      await encerrar(b, "running")

      expect(await runs.contasComRunDesde(desde)).toEqual([a])
    })
  })
}
