import { config } from "@config/index"
import { beforeEach, describe, expect, it } from "vitest"
import { type ContractEnv, criarDuasContas } from "./env"

export function routineContract(make: () => Promise<ContractEnv> | ContractEnv): void {
  describe("contrato: RoutineStore", () => {
    let env: ContractEnv

    beforeEach(async () => {
      env = await make()
      await env.reset?.()
    })

    it("anotar devolve a nota ativa e notasAtivas a lista da conta", async () => {
      const { a } = await criarDuasContas(env.stores)
      const nota = await env.stores.routine.anotar(a, "acordo cedo e tomo água morna")

      expect(nota).toMatchObject({
        conta_id: a,
        texto: "acordo cedo e tomo água morna",
        ativa: true,
      })
      const ativas = await env.stores.routine.notasAtivas(a)
      expect(ativas.map((n) => n.id)).toEqual([nota.id])
    })

    it("anotar aceita até 200 caracteres e recusa mais com texto_longo", async () => {
      const { a } = await criarDuasContas(env.stores)

      await expect(env.stores.routine.anotar(a, "x".repeat(200))).resolves.toMatchObject({
        texto: "x".repeat(200),
      })
      await expect(env.stores.routine.anotar(a, "x".repeat(201))).rejects.toMatchObject({
        code: "texto_longo",
      })
    })

    it("desativar tira a nota de notasAtivas", async () => {
      const { a } = await criarDuasContas(env.stores)
      const nota = await env.stores.routine.anotar(a, "almoço cedo")
      await env.stores.routine.desativar(a, nota.id)

      expect(await env.stores.routine.notasAtivas(a)).toEqual([])
    })

    it("gravarResumo soma 1 à versão e resumo devolve a versão mais nova", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { routine } = env.stores
      const primeiro = await routine.gravarResumo(a, "versão um")
      const segundo = await routine.gravarResumo(a, "versão dois")

      expect(segundo.versao).toBe(primeiro.versao + 1)
      expect(await routine.resumo(a)).toMatchObject({
        conta_id: a,
        versao: segundo.versao,
        texto: "versão dois",
      })
    })

    it("gravarResumo aceita o limite da config e recusa um caractere a mais", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { routine } = env.stores
      const limite = config.memoria.resumoRotinaCaracteres

      await expect(routine.gravarResumo(a, "x".repeat(limite))).resolves.toMatchObject({
        texto: "x".repeat(limite),
      })
      await expect(routine.gravarResumo(a, "x".repeat(limite + 1))).rejects.toMatchObject({
        code: "texto_longo",
      })
      expect(await routine.resumo(a)).toMatchObject({ texto: "x".repeat(limite) })
    })

    it("resumo é undefined sem nenhuma versão gravada", async () => {
      const { a } = await criarDuasContas(env.stores)
      expect(await env.stores.routine.resumo(a)).toBeUndefined()
    })

    it("conta B não lê nem altera as notas e o resumo da conta A", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      const { routine } = env.stores
      const nota = await routine.anotar(a, "nota da conta A")
      await routine.gravarResumo(a, "resumo da conta A")

      expect(await routine.notasAtivas(b)).toEqual([])
      expect(await routine.resumo(b)).toBeUndefined()
      await routine.desativar(b, nota.id)
      expect((await routine.notasAtivas(a)).map((n) => n.id)).toEqual([nota.id])
    })
  })
}
