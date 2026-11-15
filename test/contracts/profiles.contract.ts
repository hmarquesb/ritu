import { beforeEach, describe, expect, it } from "vitest"
import { type ContractEnv, criarDuasContas } from "./env"

const DIA = "2026-01-15"
const CEBOLA = { tipo: "alimento" as const, valor: "Cebola" }

export function profilesContract(make: () => Promise<ContractEnv> | ContractEnv): void {
  describe("contrato: ProfileStore", () => {
    let env: ContractEnv

    beforeEach(async () => {
      env = await make()
      await env.reset?.()
    })

    it("ler sem linha devolve o perfil vazio", async () => {
      const { a } = await criarDuasContas(env.stores)
      expect(await env.stores.profiles.ler(a)).toMatchObject({
        conta_id: a,
        prakriti: null,
        origem: null,
        evitar_sempre: [],
        restricoes: [],
        nao_come: [],
        cidade_nome: null,
        cidade_lat: null,
        cidade_lon: null,
        cidade_fuso: null,
      })
    })

    it("definirPrakriti grava a prakriti, a origem e o carimbo do relógio", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.profiles.definirPrakriti(a, { vata: 0.5, pitta: 0.3, kapha: 0.2 }, "quiz")
      expect(await env.stores.profiles.ler(a)).toMatchObject({
        prakriti: { vata: 0.5, pitta: 0.3, kapha: 0.2 },
        origem: "quiz",
        atualizado_em: "2026-01-15T12:00:00.000Z",
      })
    })

    it("definirCidade arredonda lat e lon para 2 casas e null limpa tudo", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.profiles.definirCidade(a, {
        nome: "Belo Horizonte",
        lat: -19.92083,
        lon: -43.93778,
        fuso: "America/Sao_Paulo",
      })
      expect(await env.stores.profiles.ler(a)).toMatchObject({
        cidade_nome: "Belo Horizonte",
        cidade_lat: -19.92,
        cidade_lon: -43.94,
        cidade_fuso: "America/Sao_Paulo",
      })

      await env.stores.profiles.definirCidade(a, null)
      expect(await env.stores.profiles.ler(a)).toMatchObject({
        cidade_nome: null,
        cidade_lat: null,
        cidade_lon: null,
        cidade_fuso: null,
      })
    })

    it("definirRestricoes e definirNaoCome substituem as listas", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.profiles.definirRestricoes(a, ["vegetariana", "sem_gluten"])
      await env.stores.profiles.definirNaoCome(a, [{ tipo: "texto", valor: "pimenta forte" }])
      await env.stores.profiles.definirRestricoes(a, ["vegana"])

      expect(await env.stores.profiles.ler(a)).toMatchObject({
        restricoes: ["vegana"],
        nao_come: [{ tipo: "texto", valor: "pimenta forte" }],
      })
    })

    it("acrescentarEvitarSempre não duplica e carimba desde com o relógio", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.profiles.acrescentarEvitarSempre(a, [CEBOLA])
      env.clock.advance(60_000)
      await env.stores.profiles.acrescentarEvitarSempre(a, [
        { tipo: "alimento", valor: "cebola" },
        { tipo: "texto", valor: "fritura" },
      ])

      const { evitar_sempre } = await env.stores.profiles.ler(a)
      expect(evitar_sempre).toEqual([
        { tipo: "alimento", valor: "Cebola", desde: "2026-01-15T12:00:00.000Z" },
        { tipo: "texto", valor: "fritura", desde: "2026-01-15T12:01:00.000Z" },
      ])
    })

    it("removerEvitarSempre sem confirmado: true não compila e lança em tempo de execução", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.profiles.acrescentarEvitarSempre(a, [CEBOLA])

      // @ts-expect-error confirmado: true é obrigatório
      const tentativa = env.stores.profiles.removerEvitarSempre(a, CEBOLA, { confirmado: false })
      await expect(tentativa).rejects.toMatchObject({ code: "confirmacao_necessaria" })
      expect((await env.stores.profiles.ler(a)).evitar_sempre).toHaveLength(1)
    })

    it("removerEvitarSempre com confirmado: true remove o item", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.profiles.acrescentarEvitarSempre(a, [CEBOLA])
      await env.stores.profiles.removerEvitarSempre(a, CEBOLA, { confirmado: true })
      expect((await env.stores.profiles.ler(a)).evitar_sempre).toEqual([])
    })

    it("evitarTemporario é por dia", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.profiles.acrescentarEvitarTemporario(a, DIA, [
        { tipo: "grupo", valor: "castanhas" },
      ])
      expect(await env.stores.profiles.evitarTemporario(a, DIA)).toEqual([
        { tipo: "grupo", valor: "castanhas" },
      ])
      expect(await env.stores.profiles.evitarTemporario(a, "2026-01-16")).toEqual([])
    })

    it("evitarTemporario guarda restrição e não como, e não duplica", async () => {
      const { a } = await criarDuasContas(env.stores)
      const itens = [
        { tipo: "restricao" as const, valor: "vegetariana" as const },
        { tipo: "nao_come" as const, valor: "coentro" },
      ]
      await env.stores.profiles.acrescentarEvitarTemporario(a, DIA, itens)
      await env.stores.profiles.acrescentarEvitarTemporario(a, DIA, itens)

      const lidos = await env.stores.profiles.evitarTemporario(a, DIA)
      expect(lidos).toHaveLength(2)
      expect(lidos).toEqual(expect.arrayContaining(itens))
    })

    it("apagarEvitarTemporarioAntesDe apaga só os dias anteriores e devolve a contagem", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      await env.stores.profiles.acrescentarEvitarTemporario(a, "2026-01-14", [
        { tipo: "grupo", valor: "castanhas" },
      ])
      await env.stores.profiles.acrescentarEvitarTemporario(b, "2026-01-13", [
        { tipo: "grupo", valor: "castanhas" },
      ])
      await env.stores.profiles.acrescentarEvitarTemporario(a, DIA, [
        { tipo: "grupo", valor: "castanhas" },
      ])

      expect(await env.stores.profiles.apagarEvitarTemporarioAntesDe(DIA)).toBe(2)
      expect(await env.stores.profiles.evitarTemporario(a, "2026-01-14")).toEqual([])
      expect(await env.stores.profiles.evitarTemporario(a, DIA)).toEqual([
        { tipo: "grupo", valor: "castanhas" },
      ])
    })

    it("conta B não lê nem altera o perfil da conta A", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      await env.stores.profiles.definirPrakriti(a, { vata: 1 }, "quiz")
      await env.stores.profiles.acrescentarEvitarSempre(a, [CEBOLA])
      await env.stores.profiles.acrescentarEvitarTemporario(a, DIA, [
        { tipo: "grupo", valor: "castanhas" },
      ])

      expect(await env.stores.profiles.ler(b)).toMatchObject({
        prakriti: null,
        evitar_sempre: [],
      })
      await env.stores.profiles.definirPrakriti(b, { kapha: 1 }, "declarado")
      await env.stores.profiles.removerEvitarSempre(b, CEBOLA, { confirmado: true })
      await env.stores.profiles.acrescentarEvitarTemporario(b, DIA, [])

      expect(await env.stores.profiles.ler(a)).toMatchObject({
        prakriti: { vata: 1 },
        origem: "quiz",
        evitar_sempre: [{ tipo: "alimento", valor: "Cebola", desde: "2026-01-15T12:00:00.000Z" }],
      })
      expect(await env.stores.profiles.evitarTemporario(a, DIA)).toEqual([
        { tipo: "grupo", valor: "castanhas" },
      ])
    })
  })
}
