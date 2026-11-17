import { beforeEach, describe, expect, it } from "vitest"
import { type ContractEnv, criarDuasContas } from "./env"

const DIA = "2026-01-15"

export function shortagesContract(make: () => Promise<ContractEnv> | ContractEnv): void {
  describe("contrato: ShortageStore", () => {
    let env: ContractEnv

    beforeEach(async () => {
      env = await make()
      await env.reset?.()
    })

    it("registrar duas vezes para a mesma conta, alimento e dia mantém uma linha", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.shortages.registrar(a, [{ alimento_id: "cebola", origem: "nao_tenho" }], DIA)
      await env.stores.shortages.registrar(
        a,
        [{ alimento_id: "cebola", origem: "teria_entrado" }],
        DIA,
      )

      expect(await env.stores.shortages.diasComFalta(a, "2026-01-01")).toEqual([
        { alimento_id: "cebola", dias: 1, ultimo_dia: DIA },
      ])
    })

    it("diasComFalta conta dias distintos dentro da janela e ignora os mais antigos", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { shortages } = env.stores
      await shortages.registrar(a, [{ alimento_id: "alho", origem: "nao_tenho" }], "2026-01-01")
      await shortages.registrar(a, [{ alimento_id: "alho", origem: "nao_tenho" }], "2026-01-10")
      await shortages.registrar(a, [{ alimento_id: "alho", origem: "teria_entrado" }], "2026-01-14")
      await shortages.registrar(a, [{ alimento_id: "alho", origem: "nao_tenho" }], DIA)
      await shortages.registrar(a, [{ alimento_id: "gengibre", origem: "nao_tenho" }], "2026-01-02")

      expect(await shortages.diasComFalta(a, "2026-01-05")).toEqual([
        { alimento_id: "alho", dias: 3, ultimo_dia: DIA },
      ])
    })

    it("apagarDoAlimento apaga as faltas do alimento só na conta pedida", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      const { shortages } = env.stores
      await shortages.registrar(a, [{ alimento_id: "cebola", origem: "nao_tenho" }], DIA)
      await shortages.registrar(a, [{ alimento_id: "alho", origem: "nao_tenho" }], DIA)
      await shortages.registrar(b, [{ alimento_id: "cebola", origem: "nao_tenho" }], DIA)

      await shortages.apagarDoAlimento(a, "cebola")

      expect(await shortages.diasComFalta(a, "2026-01-01")).toEqual([
        { alimento_id: "alho", dias: 1, ultimo_dia: DIA },
      ])
      expect(await shortages.diasComFalta(b, "2026-01-01")).toHaveLength(1)
    })

    it("porNaLista faz upsert por alimento e tirarDaLista remove", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { shortages } = env.stores
      await shortages.porNaLista(a, {
        alimento_id: "cebola",
        motivo: "faltou_hoje",
        detalhe: "primeiro",
      })
      await shortages.porNaLista(a, {
        alimento_id: "cebola",
        motivo: "fez_falta",
        detalhe: "segundo",
      })

      const lista = await shortages.lista(a)
      expect(lista).toHaveLength(1)
      expect(lista[0]).toMatchObject({
        conta_id: a,
        alimento_id: "cebola",
        motivo: "fez_falta",
        detalhe: "segundo",
      })

      await shortages.tirarDaLista(a, "cebola")
      expect(await shortages.lista(a)).toEqual([])
    })

    it("porNaLista aceita o motivo pessoa, sem detalhe, e lista devolve o item", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { shortages } = env.stores
      await shortages.porNaLista(a, { alimento_id: "gengibre", motivo: "pessoa", detalhe: "" })

      const lista = await shortages.lista(a)
      expect(lista).toHaveLength(1)
      expect(lista[0]).toMatchObject({
        conta_id: a,
        alimento_id: "gengibre",
        motivo: "pessoa",
        detalhe: "",
      })
    })

    it("apagarFaltasAntesDe apaga as faltas de dias anteriores, de todas as contas, e devolve a quantidade", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      const { shortages } = env.stores
      await shortages.registrar(a, [{ alimento_id: "cebola", origem: "nao_tenho" }], "2026-01-10")
      await shortages.registrar(b, [{ alimento_id: "alho", origem: "nao_tenho" }], "2026-01-09")
      await shortages.registrar(a, [{ alimento_id: "cebola", origem: "nao_tenho" }], DIA)

      expect(await shortages.apagarFaltasAntesDe("2026-01-12")).toBe(2)
      expect(await shortages.diasComFalta(a, "2026-01-01")).toEqual([
        { alimento_id: "cebola", dias: 1, ultimo_dia: DIA },
      ])
      expect(await shortages.diasComFalta(b, "2026-01-01")).toEqual([])
    })

    it("conta B não lê, apaga nem tira itens da conta A", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      const { shortages } = env.stores
      await shortages.registrar(a, [{ alimento_id: "cebola", origem: "nao_tenho" }], DIA)
      await shortages.porNaLista(a, { alimento_id: "cebola", motivo: "faltou_hoje", detalhe: "x" })

      expect(await shortages.diasComFalta(b, "2026-01-01")).toEqual([])
      expect(await shortages.lista(b)).toEqual([])

      await shortages.apagarDoAlimento(b, "cebola")
      await shortages.tirarDaLista(b, "cebola")

      expect(await shortages.diasComFalta(a, "2026-01-01")).toHaveLength(1)
      expect(await shortages.lista(a)).toHaveLength(1)
    })
  })
}
