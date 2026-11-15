import { llmCotas } from "@config/llm-cotas"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { chamarComPapel, SemModeloError } from "./chamar"
import { LlmError } from "./errors"
import { createModelRouter, type Troca } from "./router"

const [decisao0, decisao1] = llmCotas.papeis.decisao
const schema = z.object({ ok: z.boolean() })
const pedido = {
  papel: "decisao" as const,
  instrucoes: "SEGREDO-INSTRUCAO",
  entrada: "SEGREDO-ENTRADA",
  schema,
}

function setup(respostas: unknown[], limitesPorTeste = {}) {
  const clock = createFixedClock("2026-06-01T20:00:10Z")
  const ledger = createMemoryLedger(clock, limitesPorTeste)
  const telemetry = createMemoryTelemetry()
  const router = createModelRouter({ ledger, clock, telemetry })
  const client = createFakeLlm(respostas)
  return { ledger, telemetry, client, deps: { router, client, telemetry } }
}

describe("chamarComPapel", () => {
  it("sucesso: dado, modelo principal, tokens e contagens", async () => {
    const { deps, ledger } = setup([{ ok: true }])
    const r = await chamarComPapel(deps, pedido)
    expect(r).toEqual({
      dado: { ok: true },
      modelo: decisao0,
      tokens: { entrada: 10, saida: 5 },
      trocas: 0,
      tentativas: 1,
    })
    const uso = (await ledger.uso()).find((u) => u.modelo === decisao0)
    expect(uso?.minuto.tokens).toBe(15)
  })

  it("rate_limit troca para o segundo modelo", async () => {
    const { deps } = setup([{ erro: "rate_limit" }, { ok: true }])
    const trocas: Troca[] = []
    const r = await chamarComPapel(deps, { ...pedido, aoTrocar: (t) => trocas.push(t) })
    expect(r.modelo).toBe(decisao1)
    expect(r.trocas).toBe(1)
    expect(r.tentativas).toBe(2)
    expect(trocas).toEqual([{ papel: "decisao", de: decisao0, para: decisao1, motivo: "429" }])
  })

  it("resposta_invalida: uma nova tentativa no mesmo modelo", async () => {
    const { deps } = setup([{ erro: "resposta_invalida" }, { ok: true }])
    const r = await chamarComPapel(deps, pedido)
    expect(r.modelo).toBe(decisao0)
    expect(r.tentativas).toBe(2)
    expect(r.trocas).toBe(0)
  })

  it("resposta_invalida duas vezes lança o LlmError", async () => {
    const { deps } = setup([{ erro: "resposta_invalida" }, { erro: "resposta_invalida" }])
    await expect(chamarComPapel(deps, pedido)).rejects.toMatchObject({
      code: "resposta_invalida",
    })
  })

  it("timeout lança depois de registrar a falha", async () => {
    const { deps, telemetry } = setup([{ erro: "timeout" }])
    const erro = await chamarComPapel(deps, pedido).catch((e) => e)
    expect(erro).toBeInstanceOf(LlmError)
    expect(erro.code).toBe("timeout")
    expect(
      telemetry.metricas.find((m) => m.nome === "ritu_llm_erros_total")?.rotulos,
    ).toMatchObject({ codigo: "timeout" })
  })

  it("sem modelo lança SemModeloError", async () => {
    const zero = { rpm: 0, tpm: 0, rpd: 0 }
    const limites = Object.fromEntries(llmCotas.papeis.decisao.map((m) => [m, zero]))
    const { deps } = setup([], limites)
    const erro = await chamarComPapel(deps, pedido).catch((e) => e)
    expect(erro).toBeInstanceOf(SemModeloError)
    expect(erro.code).toBe("sem_modelo")
  })

  it("respeita preferir", async () => {
    const { deps } = setup([{ ok: true }])
    const r = await chamarComPapel(deps, { ...pedido, preferir: decisao1 })
    expect(r.modelo).toBe(decisao1)
  })

  it("span llm.chamada só com atributos permitidos e sem texto", async () => {
    const { deps, telemetry } = setup([{ ok: true }])
    await chamarComPapel(deps, pedido)
    const span = telemetry.spans.find((s) => s.nome === "llm.chamada")
    expect(span?.atributos).toMatchObject({
      "llm.papel": "decisao",
      "gen_ai.request.model": decisao0,
      "gen_ai.usage.input_tokens": 10,
      "gen_ai.usage.output_tokens": 5,
      "llm.tentativas": 1,
      "llm.troca_de_modelo": false,
    })
    expect(JSON.stringify(telemetry)).not.toContain("SEGREDO")
  })
})
