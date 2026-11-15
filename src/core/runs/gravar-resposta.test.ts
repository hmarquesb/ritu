import { describe, expect, it } from "vitest"
import type { Stores, Transactor } from "@/core/stores"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { gravarResposta } from "./gravar-resposta"
import type { Pergunta, RespostaDaPessoa } from "./pergunta"

const CONTA = "conta-1"
const DIA = "2026-05-10"
const pergunta: Pergunta = {
  tipo: "casa",
  texto: "Você tem?",
  itens: [
    { alimento_id: "abobora", nome: "Abóbora" },
    { alimento_id: "ovo", nome: "Ovo" },
    { alimento_id: "couve", nome: "Couve" },
  ],
}

function montar() {
  const clock = createFixedClock("2026-05-10T12:00:00.000Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  return { stores, telemetry, deps: { tx: stores as Transactor, telemetry } }
}

const casa = (
  ...itens: { alimento_id: string; resposta: "tenho" | "nao_tenho" | "nao_gosto" }[]
): RespostaDaPessoa => ({ tipo: "casa", itens })

describe("gravarResposta", () => {
  it("Tenho grava tem, confirmado agora, origem pergunta, e apaga a falta anterior", async () => {
    const { stores, deps } = montar()
    await stores.shortages.registrar(
      CONTA,
      [{ alimento_id: "abobora", origem: "nao_tenho" }],
      "2026-05-09",
    )
    await gravarResposta(
      deps,
      CONTA,
      "run-1",
      DIA,
      pergunta,
      casa({ alimento_id: "abobora", resposta: "tenho" }),
    )
    const [item] = await stores.pantry.listar(CONTA)
    expect(item).toMatchObject({ alimento_id: "abobora", estado: "tem", origem: "pergunta" })
    expect(item?.confirmado_em).toBe("2026-05-10T12:00:00.000Z")
    expect(await stores.shortages.diasComFalta(CONTA, "2026-01-01")).toEqual([])
  })

  it("Não tenho marca acabou e grava a falta com o run e o dia", async () => {
    const { stores, telemetry, deps } = montar()
    await stores.pantry.registrar(CONTA, [{ alimento_id: "ovo" }], "tela")
    await gravarResposta(
      deps,
      CONTA,
      "run-1",
      DIA,
      pergunta,
      casa({ alimento_id: "ovo", resposta: "nao_tenho" }),
    )
    const [item] = await stores.pantry.listar(CONTA)
    expect(item).toMatchObject({ alimento_id: "ovo", estado: "acabou" })
    expect(await stores.shortages.diasComFalta(CONTA, "2026-01-01")).toEqual([
      { alimento_id: "ovo", dias: 1, ultimo_dia: DIA },
    ])
    expect(telemetry.metricas).toEqual([
      { tipo: "contador", nome: "ritu_faltas_total", valor: 1, rotulos: { origem: "nao_tenho" } },
    ])
  })

  it("Não gosto grava nao_gosta e não cria item em casa", async () => {
    const { stores, telemetry, deps } = montar()
    await gravarResposta(
      deps,
      CONTA,
      "run-1",
      DIA,
      pergunta,
      casa({ alimento_id: "couve", resposta: "nao_gosto" }),
    )
    expect(await stores.pantry.listar(CONTA)).toEqual([])
    const [pref] = await stores.preferences.ler(CONTA, [{ tipo: "alimento", id: "couve" }])
    expect(pref?.gosto).toBe("nao_gosta")
    expect(telemetry.metricas.map((m) => m.nome)).toEqual(["ritu_gosto_total"])
  })

  it("Pular, item ausente, come e variante não gravam nada", async () => {
    const { stores, telemetry, deps } = montar()
    const nada = async (p: Pergunta, r: RespostaDaPessoa) =>
      gravarResposta(deps, CONTA, "run-1", DIA, p, r)
    await nada(pergunta, { tipo: "pular" })
    await nada(pergunta, casa())
    await nada(pergunta, casa({ alimento_id: "fora", resposta: "tenho" }))
    await nada(
      { tipo: "come", texto: "?", alimento_id: "ovo", nome: "Ovo" },
      { tipo: "come", resposta: "nao_como" },
    )
    await nada(
      { tipo: "variante", texto: "?", incomodo: "x", opcoes: [{ id: "a", texto: "A" }] },
      { tipo: "variante", variante: "a" },
    )
    expect(await stores.pantry.listar(CONTA)).toEqual([])
    expect(await stores.preferences.ler(CONTA)).toEqual([])
    expect(await stores.shortages.diasComFalta(CONTA, "2026-01-01")).toEqual([])
    expect(telemetry.metricas).toEqual([])
  })

  it("soma uma métrica por item", async () => {
    const { telemetry, deps } = montar()
    await gravarResposta(
      deps,
      CONTA,
      "run-1",
      DIA,
      pergunta,
      casa(
        { alimento_id: "abobora", resposta: "tenho" },
        { alimento_id: "ovo", resposta: "nao_tenho" },
        { alimento_id: "couve", resposta: "nao_gosto" },
      ),
    )
    expect(telemetry.metricas.map((m) => m.nome).sort()).toEqual([
      "ritu_faltas_total",
      "ritu_gosto_total",
    ])
  })

  it("com falha no meio, nada é gravado e nenhuma métrica soma", async () => {
    const { stores, telemetry } = montar()
    const falho: Transactor = {
      emTransacao: (fn) =>
        stores.emTransacao((s: Stores) =>
          fn({
            ...s,
            preferences: {
              ...s.preferences,
              definirGosto: async () => {
                throw new Error("falhou")
              },
            },
          }),
        ),
    }
    await expect(
      gravarResposta(
        { tx: falho, telemetry },
        CONTA,
        "run-1",
        DIA,
        pergunta,
        casa(
          { alimento_id: "ovo", resposta: "nao_tenho" },
          { alimento_id: "couve", resposta: "nao_gosto" },
        ),
      ),
    ).rejects.toThrow("falhou")
    expect(await stores.pantry.listar(CONTA)).toEqual([])
    expect(await stores.shortages.diasComFalta(CONTA, "2026-01-01")).toEqual([])
    expect(telemetry.metricas).toEqual([])
  })
})
