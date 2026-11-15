import { beforeEach, describe, expect, it } from "vitest"
import { RunAbertoError } from "@/core/runs/errors"
import { type ContractEnv, criarDuasContas } from "./env"

const DIA = "2026-01-15"

export function transactorContract(make: () => Promise<ContractEnv> | ContractEnv): void {
  describe("contrato: Transactor", () => {
    let env: ContractEnv

    beforeEach(async () => {
      env = await make()
      await env.reset?.()
    })

    it("emTransacao devolve o valor de fn e mantém as escritas feitas em várias portas", async () => {
      const { a } = await criarDuasContas(env.stores)

      const runId = await env.tx.emTransacao(async (s) => {
        const run = await s.runs.criar(a, { caminho: "casa", intencoes: [], dia: DIA })
        await s.messages.gravar(a, {
          run_id: run.id,
          autor: "pessoa",
          texto: "oi",
          com_incomodo: false,
          dia: DIA,
        })
        return run.id
      })

      expect(await env.stores.runs.aberto(a)).toMatchObject({ id: runId })
      expect((await env.stores.messages.doDia(a, DIA)).map((m) => m.texto)).toEqual(["oi"])
    })

    it("se fn lança depois de gravar em run e mensagem, nenhuma das duas escritas fica", async () => {
      const { a } = await criarDuasContas(env.stores)

      await expect(
        env.tx.emTransacao(async (s) => {
          const run = await s.runs.criar(a, { caminho: "casa", intencoes: [], dia: DIA })
          await s.messages.gravar(a, {
            run_id: run.id,
            autor: "pessoa",
            texto: "transitória",
            com_incomodo: false,
            dia: DIA,
          })
          throw new Error("falhou no meio")
        }),
      ).rejects.toThrow("falhou no meio")

      expect(await env.stores.runs.aberto(a)).toBeUndefined()
      expect(await env.stores.messages.doDia(a, DIA)).toEqual([])
    })

    it("RunAbertoError no meio da transação desfaz a mensagem gravada antes dele", async () => {
      const { a } = await criarDuasContas(env.stores)
      const existente = await env.stores.runs.criar(a, {
        caminho: "casa",
        intencoes: [],
        dia: DIA,
      })

      await expect(
        env.tx.emTransacao(async (s) => {
          await s.messages.gravar(a, {
            autor: "pessoa",
            texto: "antes do erro",
            com_incomodo: false,
            dia: DIA,
          })
          await s.runs.criar(a, { caminho: "casa", intencoes: [], dia: DIA })
        }),
      ).rejects.toBeInstanceOf(RunAbertoError)

      expect(await env.stores.runs.aberto(a)).toMatchObject({ id: existente.id })
      expect(await env.stores.messages.doDia(a, DIA)).toEqual([])
    })
  })
}
