import { beforeEach, describe, expect, it } from "vitest"
import type { Proposta } from "@/core/proposals/ports"
import type { Stores } from "@/core/stores"
import { type ContractEnv, criarDuasContas } from "./env"

const DIA = "2026-01-15"
const UM_MINUTO = 60_000

const PROPOSTA = { tool: "casa.registrar", conteudo: { alimento_id: "gengibre" } }

async function abrirRun(stores: Stores, contaId: string): Promise<string> {
  const run = await stores.runs.criar(contaId, { caminho: "casa", intencoes: [], dia: DIA })
  return run.id
}

const decisoesPorId = (propostas: Proposta[]): Record<string, string> =>
  Object.fromEntries(propostas.map((p) => [p.id, p.decisao]))

export function proposalsContract(make: () => Promise<ContractEnv> | ContractEnv): void {
  describe("contrato: ProposalStore", () => {
    let env: ContractEnv

    beforeEach(async () => {
      env = await make()
      await env.reset?.()
    })

    it("criar grava as propostas como pendentes do run e doRun as devolve", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { proposals } = env.stores
      const runId = await abrirRun(env.stores, a)

      const criadas = await proposals.criar(a, runId, [PROPOSTA])

      expect(criadas).toMatchObject([
        {
          conta_id: a,
          run_id: runId,
          tool: "casa.registrar",
          conteudo: { alimento_id: "gengibre" },
          decisao: "pendente",
          decidida_em: null,
        },
      ])
      expect((await proposals.doRun(a, runId)).map((p) => p.id)).toEqual([criadas[0]?.id])
    })

    it("decidir muda só proposta pendente e carimba decidida_em", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { proposals } = env.stores
      const runId = await abrirRun(env.stores, a)
      const [proposta] = await proposals.criar(a, runId, [PROPOSTA])
      if (!proposta) throw new Error("proposta não criada")
      env.clock.advance(UM_MINUTO)

      const aprovada = await proposals.decidir(a, proposta.id, "aprovada")
      expect(aprovada).toMatchObject({
        decisao: "aprovada",
        decidida_em: "2026-01-15T12:01:00.000Z",
      })

      env.clock.advance(UM_MINUTO)
      const depois = await proposals.decidir(a, proposta.id, "recusada")
      expect(depois).toMatchObject({
        decisao: "aprovada",
        decidida_em: "2026-01-15T12:01:00.000Z",
      })
    })

    it("decidir de proposta inexistente devolve undefined", async () => {
      const { a } = await criarDuasContas(env.stores)
      expect(await env.stores.proposals.decidir(a, crypto.randomUUID(), "aprovada")).toBeUndefined()
    })

    it("recusadas lista só as recusadas da tool pedida", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { proposals } = env.stores
      const runId = await abrirRun(env.stores, a)
      const [recusadaX] = await proposals.criar(a, runId, [{ tool: "tool-x", conteudo: {} }])
      const [aprovadaX] = await proposals.criar(a, runId, [{ tool: "tool-x", conteudo: {} }])
      const [recusadaY] = await proposals.criar(a, runId, [{ tool: "tool-y", conteudo: {} }])
      if (!recusadaX || !aprovadaX || !recusadaY) throw new Error("proposta não criada")
      await proposals.decidir(a, recusadaX.id, "recusada")
      await proposals.decidir(a, aprovadaX.id, "aprovada")
      await proposals.decidir(a, recusadaY.id, "recusada")

      expect((await proposals.recusadas(a, "tool-x")).map((p) => p.id)).toEqual([recusadaX.id])
    })

    it("expirarDosRuns passa as pendentes desses runs a expirada e devolve a quantidade", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { proposals, runs } = env.stores

      const r1 = await abrirRun(env.stores, a)
      const [p1] = await proposals.criar(a, r1, [PROPOSTA])
      const [p2] = await proposals.criar(a, r1, [PROPOSTA])
      if (!p1 || !p2) throw new Error("proposta não criada")
      await proposals.decidir(a, p2.id, "aprovada")
      await runs.atualizar(a, r1, { status: "done" })

      const r2 = await abrirRun(env.stores, a)
      const [p3] = await proposals.criar(a, r2, [PROPOSTA])
      if (!p3) throw new Error("proposta não criada")
      await runs.atualizar(a, r2, { status: "done" })

      const r3 = await abrirRun(env.stores, a)
      const [p4] = await proposals.criar(a, r3, [PROPOSTA])
      if (!p4) throw new Error("proposta não criada")

      expect(await proposals.expirarDosRuns([r1, r2])).toBe(2)
      expect(decisoesPorId(await proposals.doRun(a, r1))).toEqual({
        [p1.id]: "expirada",
        [p2.id]: "aprovada",
      })
      expect(decisoesPorId(await proposals.doRun(a, r2))).toEqual({ [p3.id]: "expirada" })
      expect(decisoesPorId(await proposals.doRun(a, r3))).toEqual({ [p4.id]: "pendente" })
    })

    it("conta B não lê nem decide as propostas da conta A", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      const { proposals } = env.stores
      const runId = await abrirRun(env.stores, a)
      const [proposta] = await proposals.criar(a, runId, [PROPOSTA])
      if (!proposta) throw new Error("proposta não criada")

      expect(await proposals.doRun(b, runId)).toEqual([])
      expect(await proposals.decidir(b, proposta.id, "aprovada")).toBeUndefined()
      await proposals.decidir(b, proposta.id, "recusada")
      await proposals.recusadas(b, "casa.registrar")

      expect(decisoesPorId(await proposals.doRun(a, runId))).toEqual({
        [proposta.id]: "pendente",
      })
    })
  })
}
