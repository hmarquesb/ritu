import { beforeEach, describe, expect, it } from "vitest"
import type { Padrao } from "@/core/patterns/ports"
import type { Stores } from "@/core/stores"
import { type ContractEnv, criarDuasContas } from "./env"

const UM_MINUTO = 60_000

const PADRAO = {
  tipo: "ajuda_em_estado" as const,
  chave: "pouco_fogo",
  frase: "Chá quente costuma ajudar quando você está com frio",
  ocorrencias: 3,
}

async function proporPadrao(
  stores: Stores,
  contaId: string,
  dados: typeof PADRAO,
): Promise<Padrao> {
  const padrao = await stores.patterns.propor(contaId, dados)
  if (!padrao) throw new Error("padrão não criado")
  return padrao
}

export function patternsContract(make: () => Promise<ContractEnv> | ContractEnv): void {
  describe("contrato: PatternStore", () => {
    let env: ContractEnv

    beforeEach(async () => {
      env = await make()
      await env.reset?.()
    })

    it("propor cria o padrão como candidato", async () => {
      const { a } = await criarDuasContas(env.stores)
      const padrao = await proporPadrao(env.stores, a, PADRAO)

      expect(padrao).toMatchObject({
        conta_id: a,
        tipo: "ajuda_em_estado",
        chave: "pouco_fogo",
        frase: PADRAO.frase,
        ocorrencias: 3,
        status: "candidato",
        decidido_em: null,
      })
    })

    it("propor devolve undefined quando o padrão já existe, seja candidato, confirmado ou recusado", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { patterns } = env.stores
      const candidato = await proporPadrao(env.stores, a, PADRAO)
      expect(await patterns.propor(a, PADRAO)).toBeUndefined()

      await patterns.decidir(a, candidato.id, "recusado")
      expect(await patterns.propor(a, PADRAO)).toBeUndefined()

      const outra = { ...PADRAO, chave: "outra_chave" }
      const confirmado = await proporPadrao(env.stores, a, outra)
      await patterns.decidir(a, confirmado.id, "confirmado")
      expect(await patterns.propor(a, outra)).toBeUndefined()
    })

    it("propor aceita a mesma chave com outro tipo", async () => {
      const { a } = await criarDuasContas(env.stores)
      await proporPadrao(env.stores, a, PADRAO)

      const outroTipo = await env.stores.patterns.propor(a, {
        ...PADRAO,
        tipo: "estados_juntos",
      })
      expect(outroTipo).toMatchObject({ tipo: "estados_juntos", status: "candidato" })
    })

    it("decidir grava o status, carimba decidido_em e listar filtra pelo status", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { patterns } = env.stores
      const padrao = await proporPadrao(env.stores, a, PADRAO)
      env.clock.advance(UM_MINUTO)

      await patterns.decidir(a, padrao.id, "confirmado")

      expect(await patterns.listar(a, "confirmado")).toMatchObject([
        { id: padrao.id, status: "confirmado", decidido_em: "2026-01-15T12:01:00.000Z" },
      ])
      expect(await patterns.listar(a, "candidato")).toEqual([])
      expect(await patterns.listar(a)).toHaveLength(1)
    })

    it("apagar remove o padrão da conta", async () => {
      const { a } = await criarDuasContas(env.stores)
      const padrao = await proporPadrao(env.stores, a, PADRAO)
      await env.stores.patterns.apagar(a, padrao.id)

      expect(await env.stores.patterns.listar(a)).toEqual([])
    })

    it("conta B não lista, decide nem apaga os padrões da conta A", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      const { patterns } = env.stores
      const padrao = await proporPadrao(env.stores, a, PADRAO)

      expect(await patterns.listar(b)).toEqual([])
      await patterns.decidir(b, padrao.id, "confirmado")
      await patterns.apagar(b, padrao.id)

      expect(await patterns.listar(a, "candidato")).toMatchObject([
        { id: padrao.id, status: "candidato", decidido_em: null },
      ])
    })
  })
}
