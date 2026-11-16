import { describe, expect, it } from "vitest"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { createPatterns } from "./index"

const CONTA = "conta-1"

function montar() {
  const clock = createFixedClock("2026-06-03T20:00:00Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const padroes = createPatterns({ stores, kb: createMiniKnowledge(), clock, telemetry })
  return { padroes, stores }
}

describe("createPatterns", () => {
  it("detectarPadroes sem runs devolve zeros", async () => {
    const { padroes } = montar()

    await expect(padroes.detectarPadroes()).resolves.toEqual({
      contas: 0,
      propostos: 0,
      falhas: 0,
    })
  })

  it("detectarPadroesDaConta de uma conta sem run devolve 0", async () => {
    const { padroes } = montar()

    await expect(padroes.detectarPadroesDaConta(CONTA)).resolves.toBe(0)
  })

  it("decidirPadrao confirma um candidato da conta", async () => {
    const { padroes, stores } = montar()
    const padrao = await stores.patterns.propor(CONTA, {
      tipo: "ajuda_em_estado",
      chave: "com_frio|pratica:cha-gengibre-canela",
      frase: "Quando você está com frio, chá de gengibre com canela costuma te ajudar.",
      ocorrencias: 3,
    })
    if (!padrao) throw new Error("o padrão devia ser criado")

    await padroes.decidirPadrao(CONTA, padrao.id, "confirmado")

    const confirmados = await stores.patterns.listar(CONTA, "confirmado")
    expect(confirmados.map((p) => p.id)).toEqual([padrao.id])
  })

  it("decidirPadrao com padrão inexistente lança padrao_invalido", async () => {
    const { padroes } = montar()

    await expect(padroes.decidirPadrao(CONTA, "nao-existe", "recusado")).rejects.toMatchObject({
      code: "padrao_invalido",
    })
  })

  it("apagarPadrao tira o padrão da conta", async () => {
    const { padroes, stores } = montar()
    const padrao = await stores.patterns.propor(CONTA, {
      tipo: "estados_juntos",
      chave: "com_frio+agitada",
      frase: "Quando você está com frio, costuma estar também agitada.",
      ocorrencias: 4,
    })
    if (!padrao) throw new Error("o padrão devia ser criado")

    await padroes.apagarPadrao(CONTA, padrao.id)

    expect(await stores.patterns.listar(CONTA)).toEqual([])
  })

  it("apagarPadrao com padrão inexistente lança padrao_invalido", async () => {
    const { padroes } = montar()

    await expect(padroes.apagarPadrao(CONTA, "nao-existe")).rejects.toMatchObject({
      code: "padrao_invalido",
    })
  })
})
