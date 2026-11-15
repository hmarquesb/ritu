import { beforeEach, describe, expect, it } from "vitest"
import { type ContractEnv, criarDuasContas } from "./env"

const ARROZ = { tipo: "alimento" as const, id: "arroz-branco" }
const GENGIBRE = { tipo: "alimento" as const, id: "gengibre" }
const CHA = { tipo: "preparo" as const, id: "cha-de-gengibre" }

export function preferencesContract(make: () => Promise<ContractEnv> | ContractEnv): void {
  describe("contrato: PreferenceStore", () => {
    let env: ContractEnv

    beforeEach(async () => {
      env = await make()
      await env.reset?.()
    })

    it("ler sem itens devolve todas as preferências da conta; com itens, só as pedidas que existem", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { preferences } = env.stores
      await preferences.definirGosto(a, ARROZ, "gosta")
      await preferences.definirGosto(a, GENGIBRE, "nao_gosta")
      await preferences.definirGosto(a, CHA, "gosta")

      expect(await preferences.ler(a)).toHaveLength(3)
      const pedidas = await preferences.ler(a, [ARROZ, { tipo: "pratica", id: "inexistente" }])
      expect(pedidas).toHaveLength(1)
      expect(pedidas[0]).toMatchObject({ item_tipo: "alimento", item_id: "arroz-branco" })
    })

    it("definirGosto grava o gosto e não mexe nos contadores", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { preferences } = env.stores
      await preferences.contarResultado(a, ARROZ, "ajudou")
      await preferences.definirGosto(a, ARROZ, "gosta")

      expect((await preferences.ler(a, [ARROZ]))[0]).toMatchObject({
        gosto: "gosta",
        ajudou: 1,
        nao_ajudou: 0,
        nao_fez: 0,
      })

      await preferences.definirGosto(a, ARROZ, null)
      expect((await preferences.ler(a, [ARROZ]))[0]).toMatchObject({ gosto: null, ajudou: 1 })
    })

    it("contarResultado ajudou soma 1 só no contador de ajudou", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.preferences.contarResultado(a, ARROZ, "ajudou")

      expect((await env.stores.preferences.ler(a, [ARROZ]))[0]).toMatchObject({
        ajudou: 1,
        nao_ajudou: 0,
        nao_fez: 0,
        ultimos_resultados: ["ajudou"],
      })
    })

    it("nao_fez soma só no contador e não entra em ultimos_resultados", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.preferences.contarResultado(a, ARROZ, "ajudou")
      await env.stores.preferences.contarResultado(a, ARROZ, "nao_fez")

      expect((await env.stores.preferences.ler(a, [ARROZ]))[0]).toMatchObject({
        ajudou: 1,
        nao_fez: 1,
        ultimos_resultados: ["ajudou"],
      })
    })

    it("ultimos_resultados guarda os dois mais recentes, o mais novo primeiro", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { preferences } = env.stores
      await preferences.contarResultado(a, ARROZ, "ajudou")
      await preferences.contarResultado(a, ARROZ, "nao_ajudou")
      await preferences.contarResultado(a, ARROZ, "ajudou")

      expect((await preferences.ler(a, [ARROZ]))[0]).toMatchObject({
        ajudou: 2,
        nao_ajudou: 1,
        ultimos_resultados: ["ajudou", "nao_ajudou"],
      })
    })

    it("marcarSugerido carimba ultima_sugestao_em com o relógio", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.preferences.marcarSugerido(a, [ARROZ, CHA])

      const lidas = await env.stores.preferences.ler(a, [ARROZ, CHA])
      expect(lidas).toHaveLength(2)
      for (const pref of lidas) {
        expect(pref.ultima_sugestao_em).toBe("2026-01-15T12:00:00.000Z")
      }
    })

    it("contagem conta as preferências com gosto e as com algum resultado", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { preferences } = env.stores
      await preferences.definirGosto(a, ARROZ, "gosta")
      await preferences.contarResultado(a, ARROZ, "ajudou")
      await preferences.definirGosto(a, GENGIBRE, "nao_gosta")
      await preferences.contarResultado(a, CHA, "nao_fez")

      expect(await preferences.contagem(a)).toEqual({ de_gosto: 2, de_resultado: 2 })
    })

    it("apagar remove a preferência do item", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.preferences.definirGosto(a, ARROZ, "gosta")
      await env.stores.preferences.apagar(a, ARROZ)

      expect(await env.stores.preferences.ler(a)).toEqual([])
    })

    it("conta B não lê nem altera as preferências da conta A", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      const { preferences } = env.stores
      await preferences.definirGosto(a, ARROZ, "gosta")
      await preferences.contarResultado(a, ARROZ, "ajudou")

      expect(await preferences.ler(b)).toEqual([])
      expect(await preferences.contagem(b)).toEqual({ de_gosto: 0, de_resultado: 0 })

      await preferences.definirGosto(b, ARROZ, "nao_gosta")
      await preferences.contarResultado(b, ARROZ, "nao_ajudou")
      await preferences.marcarSugerido(b, [ARROZ])
      await preferences.apagar(b, ARROZ)

      expect(await preferences.ler(a, [ARROZ])).toMatchObject([
        { gosto: "gosta", ajudou: 1, nao_ajudou: 0, ultima_sugestao_em: null },
      ])
    })
  })
}
