import { beforeEach, describe, expect, it } from "vitest"
import type { Stores } from "@/core/stores"
import { type ContractEnv, criarDuasContas } from "./env"

const DIA = "2026-01-15"
const UMA_HORA = 3_600_000
const CIDADE = { nome: "São Paulo", lat: -23.55, lon: -46.63, fuso: "America/Sao_Paulo" }

/** Escreve em todas as portas que a conta usa e devolve o id do run aberto. */
async function popularConta(stores: Stores, contaId: string): Promise<string> {
  await stores.profiles.definirCidade(contaId, CIDADE)
  await stores.profiles.definirRestricoes(contaId, ["vegetariana"])
  await stores.profiles.acrescentarEvitarSempre(contaId, [{ tipo: "texto", valor: "pimenta" }])
  await stores.profiles.acrescentarEvitarTemporario(contaId, DIA, [
    { tipo: "texto", valor: "café" },
  ])
  await stores.pantry.registrar(contaId, [{ alimento_id: "gengibre" }], "conversa")
  await stores.preferences.definirGosto(contaId, { tipo: "alimento", id: "gengibre" }, "gosta")
  await stores.shortages.registrar(contaId, [{ alimento_id: "cebola", origem: "nao_tenho" }], DIA)
  await stores.shortages.porNaLista(contaId, {
    alimento_id: "cebola",
    motivo: "fez_falta",
    detalhe: "sopa",
  })
  await stores.routine.anotar(contaId, "acordo cedo")
  await stores.routine.gravarResumo(contaId, "rotina")
  await stores.patterns.propor(contaId, {
    tipo: "ajuda_em_estado",
    chave: "frio",
    frase: "chá quente ajuda",
    ocorrencias: 2,
  })
  await stores.messages.gravar(contaId, {
    autor: "pessoa",
    texto: "oi",
    com_incomodo: false,
    dia: DIA,
  })
  const run = await stores.runs.criar(contaId, { caminho: "casa", intencoes: [], dia: DIA })
  await stores.runs.votar(contaId, run.id, "up")
  await stores.outcomes.criar(contaId, run.id, [
    { tipo: "cha", alimentos: ["gengibre"], titulo: "Chá de gengibre" },
  ])
  await stores.proposals.criar(contaId, run.id, [{ tool: "casa.registrar", conteudo: {} }])
  return run.id
}

export function deleteAccountContract(make: () => Promise<ContractEnv> | ContractEnv): void {
  describe("contrato: accounts.apagar em cascata", () => {
    let env: ContractEnv

    beforeEach(async () => {
      env = await make()
      await env.reset?.()
    })

    it("apagar remove a conta e os dados dela em todas as portas", async () => {
      const { a } = await criarDuasContas(env.stores)
      const runId = await popularConta(env.stores, a)
      const { stores } = env

      await stores.accounts.apagar(a)

      expect(await stores.accounts.buscar(a)).toBeUndefined()
      expect(await stores.profiles.ler(a)).toMatchObject({
        cidade_nome: null,
        restricoes: [],
        evitar_sempre: [],
        prakriti: null,
      })
      expect(await stores.profiles.evitarTemporario(a, DIA)).toEqual([])
      expect(await stores.pantry.listar(a)).toEqual([])
      expect(await stores.preferences.ler(a)).toEqual([])
      expect(await stores.preferences.contagem(a)).toEqual({ de_gosto: 0, de_resultado: 0 })
      expect(await stores.shortages.lista(a)).toEqual([])
      expect(await stores.shortages.diasComFalta(a, "2026-01-01")).toEqual([])
      expect(await stores.routine.notasAtivas(a)).toEqual([])
      expect(await stores.routine.resumo(a)).toBeUndefined()
      expect(await stores.patterns.listar(a)).toEqual([])
      expect(await stores.messages.doDia(a, DIA)).toEqual([])
      expect(await stores.outcomes.pendentes(a)).toEqual([])
      expect(await stores.outcomes.doRun(a, runId)).toEqual([])
      expect(await stores.proposals.doRun(a, runId)).toEqual([])
      expect(await stores.proposals.recusadas(a, "casa.registrar")).toEqual([])
    })

    it("apagar a conta A deixa a conta B inteira", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      await popularConta(env.stores, a)
      const runB = await popularConta(env.stores, b)
      const { stores } = env

      await stores.accounts.apagar(a)

      expect(await stores.accounts.buscar(b)).toMatchObject({ id: b })
      expect(await stores.pantry.listar(b)).toHaveLength(1)
      expect(await stores.routine.notasAtivas(b)).toHaveLength(1)
      expect(await stores.messages.doDia(b, DIA)).toHaveLength(1)
      expect(await stores.outcomes.pendentes(b)).toHaveLength(1)
      expect(await stores.proposals.doRun(b, runB)).toHaveLength(1)
    })

    it("runs da conta apagada somem da leitura por conta e continuam existindo para o cleanup", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { runs } = env.stores
      const run = await runs.criar(a, { caminho: "casa", intencoes: [], dia: DIA })
      await runs.atualizar(a, run.id, { status: "waiting_for_input" })

      await env.stores.accounts.apagar(a)

      expect(await runs.buscar(a, run.id)).toBeUndefined()
      expect(await runs.aberto(a)).toBeUndefined()
      env.clock.advance(UMA_HORA)
      expect(await runs.expirarEmEsperaAntesDe(env.clock.now())).toEqual([run.id])
    })
  })
}
