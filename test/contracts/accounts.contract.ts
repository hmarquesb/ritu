import { beforeEach, describe, expect, it } from "vitest"
import { type ContractEnv, criarDuasContas } from "./env"

export function accountsContract(make: () => Promise<ContractEnv> | ContractEnv): void {
  describe("contrato: AccountRepository", () => {
    let env: ContractEnv

    beforeEach(async () => {
      env = await make()
      await env.reset?.()
    })

    it("criar devolve a conta com os campos padrão e o carimbo do relógio", async () => {
      const conta = await env.stores.accounts.criar({
        tipo: "google",
        google_sub: "sub-1",
        email: "pessoa@exemplo.com",
      })
      expect(conta).toMatchObject({
        tipo: "google",
        google_sub: "sub-1",
        email: "pessoa@exemplo.com",
        expira_em: null,
        tester: false,
        aviso_aceito_em: null,
        evitar_passo: null,
        evitar_lembrete_em: null,
        dosha_adiado_em: null,
        criado_em: "2026-01-15T12:00:00.000Z",
      })
    })

    it("buscar acha a conta pelo id e buscarPorGoogleSub pelo sub", async () => {
      const { a } = await criarDuasContas(env.stores)
      expect(await env.stores.accounts.buscar(a)).toMatchObject({ id: a })
      expect(await env.stores.accounts.buscarPorGoogleSub("sub-conta-a")).toMatchObject({ id: a })
      expect(await env.stores.accounts.buscarPorGoogleSub("nao-existe")).toBeUndefined()
    })

    it("buscar trata conta de demonstração vencida como inexistente", async () => {
      const vencida = await env.stores.accounts.criar({
        tipo: "demo",
        expira_em: new Date("2026-01-15T11:00:00Z"),
      })
      const valida = await env.stores.accounts.criar({
        tipo: "demo",
        expira_em: new Date("2026-01-15T13:00:00Z"),
      })
      expect(await env.stores.accounts.buscar(vencida.id)).toBeUndefined()
      expect(await env.stores.accounts.buscar(valida.id)).toMatchObject({ id: valida.id })
    })

    it("marcar grava os campos pedidos", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.accounts.marcar(a, {
        aviso_aceito_em: "2026-01-15T12:00:00.000Z",
        evitar_passo: "pulou",
      })
      expect(await env.stores.accounts.buscar(a)).toMatchObject({
        aviso_aceito_em: "2026-01-15T12:00:00.000Z",
        evitar_passo: "pulou",
      })
    })

    it("marcar grava tester e buscar devolve o valor", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.accounts.marcar(a, { tester: true })
      expect(await env.stores.accounts.buscar(a)).toMatchObject({ id: a, tester: true })
    })

    it("apagarDemosVencidas apaga só as demonstrações vencidas e devolve a quantidade", async () => {
      await env.stores.accounts.criar({ tipo: "demo", expira_em: new Date("2026-01-15T11:00:00Z") })
      await env.stores.accounts.criar({ tipo: "demo", expira_em: new Date("2026-01-14T11:00:00Z") })
      const valida = await env.stores.accounts.criar({
        tipo: "demo",
        expira_em: new Date("2026-01-16T11:00:00Z"),
      })
      await criarDuasContas(env.stores)

      expect(await env.stores.accounts.apagarDemosVencidas()).toBe(2)
      expect(await env.stores.accounts.apagarDemosVencidas()).toBe(0)
      expect(await env.stores.accounts.buscar(valida.id)).toMatchObject({ id: valida.id })
    })

    it("conta B não altera nem apaga a conta A", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      await env.stores.accounts.marcar(b, { evitar_passo: "nenhum" })
      await env.stores.accounts.marcar(a, { evitar_passo: "pronto" })
      await env.stores.accounts.apagar(b)

      expect(await env.stores.accounts.buscar(a)).toMatchObject({
        id: a,
        evitar_passo: "pronto",
      })
      expect(await env.stores.accounts.buscar(b)).toBeUndefined()
    })
  })
}
