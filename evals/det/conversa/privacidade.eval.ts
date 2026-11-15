import { describe, expect, it } from "vitest"
import { normalizar } from "@/core/knowledge/identificar"
import { getContainer } from "@/infra/container"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { cenariosDeConversa, montarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

const kb = getContainer().knowledge

// Termos que não podem aparecer na telemetria nem nos resumos: a mensagem inteira, cada palavra
// de 5 letras ou mais e cada nome de alimento da base.
function termosProibidos(c: CenarioDeConversa): string[] {
  const texto = normalizar(c.mensagem.texto ?? "")
  const palavras = texto.split(" ").filter((p) => p.length >= 5)
  const alimentos = kb.alimentos.map((a) => normalizar(a.nome))
  return [...new Set([texto, ...palavras, ...alimentos].filter((t) => t !== ""))]
}

describe.each(Object.entries(cenariosDeConversa))("cenário %s", (nome, c) => {
  it("não deixa texto da pessoa nem nome de alimento em span, métrica, log ou resumo", async () => {
    const llm = createFakeLlm(c.interpretacao ? [c.interpretacao] : [])
    const runtime = createScriptedRuntime(c.roteiro)
    const { contaId, deps } = await montarCenario(c, { llm, runtime })
    const resposta = await deps.conversation.conversar(contaId, c.mensagem)
    const etapas = await deps.stores.runs.etapas(contaId, resposta.run_id)

    const telemetria = normalizar(
      JSON.stringify({
        spans: deps.telemetry.spans,
        metricas: deps.telemetry.metricas,
        logs: deps.telemetry.logs,
        eventos: deps.telemetry.eventos,
      }),
    )
    const resumos = normalizar(etapas.map((e) => e.resumo ?? "").join(" | "))

    expect(termosProibidos(c).length).toBeGreaterThan(0)
    for (const termo of termosProibidos(c)) {
      expect(telemetria, `${nome} · telemetria · "${termo}"`).not.toContain(termo)
      expect(resumos, `${nome} · resumo de etapa · "${termo}"`).not.toContain(termo)
    }
  })
})
