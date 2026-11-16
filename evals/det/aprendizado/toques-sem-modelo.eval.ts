import { describe, expect, it } from "vitest"
import {
  cenariosDeAprendizado,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Toques (retorno, gosto e troca) gravam o esperado sem chamar modelo nem runtime.

function cenario(nome: string): CenarioDeConversa {
  const c = cenariosDeAprendizado[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  return c
}

// Conta quantas chamadas de modelo (etapas llm) e de passos do runtime o run já tem.
async function chamadas(deps: DepsDoCenario, contaId: string, runId: string) {
  const etapas = await deps.stores.runs.etapas(contaId, runId)
  return {
    llm: etapas.filter((e) => e.tipo === "llm").length,
    passos: (deps.runtime as { pedidos?: unknown[] }).pedidos?.length ?? 0,
  }
}

const contagemDaMetrica = (deps: DepsDoCenario, nome: string) =>
  deps.telemetry.metricas.filter((m) => m.nome === nome).length

describe("toques gravam sem chamar modelo", () => {
  it("toque de retorno: soma o retorno e não chama modelo nem runtime", async () => {
    const base = cenario("entrega-registrada")
    const c: CenarioDeConversa = {
      ...base,
      retornos: cenario("retorno-pelo-agente").retornos,
      toques: undefined,
    }
    const { contaId, deps, runId } = await montarRodada(c)
    const antes = await chamadas(deps, contaId, runId)
    const metricaAntes = contagemDaMetrica(deps, "ritu_retorno_total")

    await deps.touches.tocarRetorno(contaId, deps.retornosSemeados[0] ?? "", "ajudou")

    expect(await chamadas(deps, contaId, runId)).toEqual(antes)
    expect(contagemDaMetrica(deps, "ritu_retorno_total")).toBe(metricaAntes + 1)
  })

  it("toque de gosto: grava a preferência e não chama modelo nem runtime", async () => {
    const c: CenarioDeConversa = { ...cenario("troca-por-toque"), toques: undefined }
    const { contaId, deps, runId } = await montarRodada(c)
    const antes = await chamadas(deps, contaId, runId)
    const metricaAntes = contagemDaMetrica(deps, "ritu_gosto_total")

    await deps.touches.tocarGosto(contaId, { tipo: "alimento", id: "gengibre" }, "gosta")

    expect(await chamadas(deps, contaId, runId)).toEqual(antes)
    expect(contagemDaMetrica(deps, "ritu_gosto_total")).toBe(metricaAntes + 1)
  })

  it("toque de troca: troca o ingrediente e não chama modelo nem runtime", async () => {
    const c: CenarioDeConversa = { ...cenario("troca-por-toque"), toques: undefined }
    const { contaId, deps, runId } = await montarRodada(c)
    const antes = await chamadas(deps, contaId, runId)
    const metricaAntes = contagemDaMetrica(deps, "ritu_troca_ingrediente_total")

    await deps.touches.trocarIngrediente(contaId, {
      runId,
      sugestao: 0,
      alimento_id: "canela",
      motivo: "trocar",
    })

    expect(await chamadas(deps, contaId, runId)).toEqual(antes)
    expect(contagemDaMetrica(deps, "ritu_troca_ingrediente_total")).toBe(metricaAntes + 1)
  })
})

// Monta o cenário e roda a mensagem até o fim: o run é a base dos toques.
async function montarRodada(c: CenarioDeConversa) {
  const { contaId, deps } = await montarCenario(c)
  const rodada = await rodarCenario(deps, contaId, c)
  return { contaId, deps, runId: rodada.final.run_id }
}
