import { describe, expect, it } from "vitest"
import type { Caminho } from "@/core/runs/ports"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { montarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"
import { cenario, com } from "./apoio"

// Um run por mensagem, em qualquer caminho: um único span `run`, com etapas e o caminho esperado.
const APROVA = { apontamentos: [] }

const CAMINHOS: [Caminho, CenarioDeConversa][] = [
  ["acompanhante", cenario("duas-intencoes")],
  ["casa", cenario("casa-sozinha")],
  ["evitar", cenario("evitar-sozinho")],
  ["retorno", cenario("retorno-conversa")],
  ["alerta", cenario("alerta-emocional")],
  ["ofensa", cenario("ofensa")],
  ["ajuda", com(cenario("ofensa"), "como você usa o que eu conto?", { intencoes: ["ajuda"] })],
  ["fora", com(cenario("so-atalhos"), "qual a capital da França?", { intencoes: ["fora"] })],
]

async function rodar(c: CenarioDeConversa) {
  const llm = createFakeLlm(c.interpretacao ? [c.interpretacao, APROVA] : [APROVA])
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { llm, runtime })
  const resposta = await deps.conversation.conversar(contaId, c.mensagem)
  const run = await deps.stores.runs.buscar(contaId, resposta.run_id)
  const etapas = await deps.stores.runs.etapas(contaId, resposta.run_id)
  return { deps, run, etapas }
}

describe.each(CAMINHOS)("caminho %s: um único span run e o run tem etapas", (caminho, c) => {
  it("sai um span run por mensagem", async () => {
    const { deps } = await rodar(c)

    expect(deps.telemetry.spans.filter((s) => s.nome === "run")).toHaveLength(1)
  })

  it("o run cai no caminho esperado e tem etapas", async () => {
    const { run, etapas } = await rodar(c)

    expect(run?.caminho).toBe(caminho)
    expect(etapas.length).toBeGreaterThan(0)
  })
})
