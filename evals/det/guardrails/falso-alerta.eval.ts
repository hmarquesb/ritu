import { describe, expect, it } from "vitest"
import { textosDaConversa } from "@/core/conversation/textos"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { cenariosDeGuardrails, montarCenario } from "../../../test/fixtures/cenarios"
import { entregaDoCha, RESPOSTA_DE_CONFORTO } from "../../../test/fixtures/cenarios/juiz-corrige"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"
import { SEM_SINAIS } from "../conversa/apoio"

// Frases que parecem alerta e não são: o guardrail de código não pode pegar nenhuma.
const FALSOS = [
  "tô morta de cansaço",
  "morrendo de fome",
  "não aguento mais esse calor",
  "dia pesado, tô pra baixo",
  "quais são as regras do Ayurveda para o jantar?",
]

// Fila do Intérprete e, depois, a aprovação do Juiz (a entrega é do momento, então o Juiz roda).
const APROVA = { apontamentos: [] }

function base(): CenarioDeConversa {
  const c = cenariosDeGuardrails["juiz-corrige"]
  if (!c) throw new Error("cenário de guardrail ausente: juiz-corrige")
  return c
}

async function montar(texto: string) {
  const c: CenarioDeConversa = {
    ...base(),
    mensagem: { texto, atalhos: [] },
    interpretacao: { ...SEM_SINAIS, intencoes: ["momento"] },
    roteiro: [entregaDoCha(RESPOSTA_DE_CONFORTO)],
  }
  const llm = createFakeLlm([c.interpretacao, APROVA])
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { llm, runtime })
  const resposta = await deps.conversation.conversar(contaId, c.mensagem)
  const run = await deps.stores.runs.buscar(contaId, resposta.run_id)
  return { contaId, deps, llm, runtime, resposta, run }
}

type Montado = Awaited<ReturnType<typeof montar>>

function resultadoDoGuardrail(m: Montado): unknown {
  return m.deps.telemetry.spans.find((s) => s.nome === "guardrail.entrada")?.atributos[
    "guardrail.resultado"
  ]
}

describe.each(FALSOS)("falso alerta: %s", (texto) => {
  it("o guardrail de código passa a mensagem adiante (resultado ok)", async () => {
    const m = await montar(texto)
    expect(resultadoDoGuardrail(m)).toBe("ok")
  })

  it("chama o Intérprete, com a mensagem na primeira chamada de modelo", async () => {
    const m = await montar(texto)
    const primeiro = (m.llm.pedidos as { entrada: string }[])[0]
    expect(primeiro?.entrada).toContain(texto)
  })

  it("não vira alerta: nem caminho alerta, nem texto fixo, nem etapa de código", async () => {
    const m = await montar(texto)
    expect(m.run?.caminho).not.toBe("alerta")
    expect(m.resposta.saida?.resposta).not.toBe(textosDaConversa.alertaEmocional)
    expect(m.resposta.saida?.resposta).not.toBe(textosDaConversa.alertaFisico)
    const porCodigo = m.deps.telemetry.metricas.filter(
      (x) => x.nome === "ritu_guardrail_total" && x.rotulos.origem === "codigo",
    )
    expect(porCodigo).toEqual([])
  })
})
