import { beforeEach, describe, expect, it } from "vitest"
import { ALIMENTO_INEXISTENTE, type ContractEnv, criarDuasContas } from "./env"

const AGORA = "2026-01-15T12:00:00.000Z"
const UMA_HORA = 3_600_000

export function pantryContract(make: () => Promise<ContractEnv> | ContractEnv): void {
  describe("contrato: PantryStore", () => {
    let env: ContractEnv

    beforeEach(async () => {
      env = await make()
      await env.reset?.()
    })

    it("registrar alimento conhecido cria o item com estado tem e confirmado agora", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.pantry.registrar(a, [{ alimento_id: "arroz-branco" }], "conversa")

      const itens = await env.stores.pantry.listar(a)
      expect(itens).toHaveLength(1)
      expect(itens[0]).toMatchObject({
        conta_id: a,
        alimento_id: "arroz-branco",
        nome_livre: null,
        nome_normalizado: null,
        estado: "tem",
        sempre_tenho: false,
        confirmado_em: AGORA,
        origem: "conversa",
      })
    })

    it("registrar de novo um item que acabou o volta para tem com nova data", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.pantry.registrar(a, [{ alimento_id: "arroz-branco" }], "conversa")
      await env.stores.pantry.marcarAcabou(a, [{ alimento_id: "arroz-branco" }])
      env.clock.advance(UMA_HORA)
      await env.stores.pantry.registrar(a, [{ alimento_id: "arroz-branco" }], "tela")

      const itens = await env.stores.pantry.listar(a)
      expect(itens).toHaveLength(1)
      expect(itens[0]).toMatchObject({
        estado: "tem",
        confirmado_em: "2026-01-15T13:00:00.000Z",
      })
    })

    it("alimento_id que a base não conhece vira nome livre e soma em desconhecidos", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.pantry.registrar(a, [{ alimento_id: ALIMENTO_INEXISTENTE }], "conversa")

      const itens = await env.stores.pantry.listar(a)
      expect(itens).toHaveLength(1)
      expect(itens[0]).toMatchObject({
        alimento_id: null,
        nome_livre: ALIMENTO_INEXISTENTE,
        nome_normalizado: "alimento inexistente",
        estado: "tem",
      })
      expect(await env.stores.pantry.desconhecidos(5)).toEqual([
        { nome: "alimento inexistente", vezes: 1 },
      ])
    })

    it("nome livre com acento ou maiúscula diferente cai na mesma linha", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.pantry.registrar(a, [{ nome_livre: "Feijão preto" }], "conversa")
      await env.stores.pantry.registrar(a, [{ nome_livre: "FEIJAO PRETO" }], "conversa")

      const itens = await env.stores.pantry.listar(a)
      expect(itens).toHaveLength(1)
      expect(itens[0]).toMatchObject({
        alimento_id: null,
        nome_livre: "Feijão preto",
        nome_normalizado: "feijao preto",
        estado: "tem",
      })
    })

    it("registrar soma em desconhecidos pelo nome normalizado", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.pantry.registrar(
        a,
        [{ nome_livre: "Jabuticaba" }, { nome_livre: "jabuticaba" }, { nome_livre: "Pitanga" }],
        "conversa",
      )

      expect(await env.stores.pantry.desconhecidos(1)).toEqual([{ nome: "jabuticaba", vezes: 2 }])
      expect(await env.stores.pantry.desconhecidos(5)).toEqual([
        { nome: "jabuticaba", vezes: 2 },
        { nome: "pitanga", vezes: 1 },
      ])
    })

    it("registrar um alimento apaga as faltas dele e o tira da lista", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.shortages.registrar(
        a,
        [{ alimento_id: "cebola", origem: "nao_tenho" }],
        "2026-01-14",
      )
      await env.stores.shortages.porNaLista(a, {
        alimento_id: "cebola",
        motivo: "faltou_hoje",
        detalhe: "Entraria no prato de hoje",
      })

      await env.stores.pantry.registrar(a, [{ alimento_id: "cebola" }], "conversa")

      expect(await env.stores.shortages.diasComFalta(a, "2026-01-01")).toEqual([])
      expect(await env.stores.shortages.lista(a)).toEqual([])
    })

    it("marcarAcabou põe o item em acabou", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.pantry.registrar(a, [{ alimento_id: "ghee" }], "conversa")
      await env.stores.pantry.marcarAcabou(a, [{ alimento_id: "ghee" }])

      expect((await env.stores.pantry.listar(a))[0]).toMatchObject({ estado: "acabou" })
    })

    it("definirSempreTenho e tirar agem pelo id do item", async () => {
      const { a } = await criarDuasContas(env.stores)
      await env.stores.pantry.registrar(a, [{ alimento_id: "mel" }], "conversa")
      const [item] = await env.stores.pantry.listar(a)
      if (!item) throw new Error("item não criado")

      await env.stores.pantry.definirSempreTenho(a, item.id, true)
      expect((await env.stores.pantry.listar(a))[0]).toMatchObject({ sempre_tenho: true })

      await env.stores.pantry.tirar(a, item.id)
      expect(await env.stores.pantry.listar(a)).toEqual([])
    })

    it("conta B não lista, altera nem tira itens da conta A", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      await env.stores.pantry.registrar(a, [{ alimento_id: "arroz-branco" }], "conversa")
      const [item] = await env.stores.pantry.listar(a)
      if (!item) throw new Error("item não criado")

      expect(await env.stores.pantry.listar(b)).toEqual([])
      await env.stores.pantry.definirSempreTenho(b, item.id, true)
      await env.stores.pantry.marcarAcabou(b, [{ alimento_id: "arroz-branco" }])
      await env.stores.pantry.tirar(b, item.id)

      const depois = await env.stores.pantry.listar(a)
      expect(depois).toHaveLength(1)
      expect(depois[0]).toMatchObject({ estado: "tem", sempre_tenho: false })
    })
  })
}
