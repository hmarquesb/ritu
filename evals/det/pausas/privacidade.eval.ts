import { describe, expect, it } from "vitest"
import { normalizar } from "@/core/knowledge/identificar"
import { type Pergunta, type RespostaDaPessoa, textoDaResposta } from "@/core/runs/pergunta"
import { getContainer } from "@/infra/container"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { cenariosComPausa, montarCenario, rodarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

const kb = getContainer().knowledge

// Resumo de etapa de pergunta: só a contagem de itens, "come" ou "variante".
const RESUMO_DA_PERGUNTA = /^(casa: \d+ itens?|come|variante)$/

// Termos que não podem aparecer na telemetria nem nos resumos: a mensagem inteira e cada palavra
// de 5 letras ou mais; os textos das perguntas e das respostas; nome e id de alimento, de incômodo
// e de variante da base.
function termosProibidos(
  c: CenarioDeConversa,
  perguntas: { pergunta: Pergunta; resposta: RespostaDaPessoa }[],
): string[] {
  const texto = normalizar(c.mensagem.texto ?? "")
  const palavras = texto.split(" ").filter((p) => p.length >= 5)
  const textos = perguntas.flatMap((p) => [
    normalizar(p.pergunta.texto),
    normalizar(textoDaResposta(p.pergunta, p.resposta)),
  ])
  const alimentos = kb.alimentos.flatMap((a) => [normalizar(a.nome), normalizar(a.id)])
  const incomodos = kb.incomodos.flatMap((i) => [
    normalizar(i.nome),
    normalizar(i.id),
    ...i.variantes.map((v) => normalizar(v.id)),
  ])
  return [...new Set([texto, ...palavras, ...textos, ...alimentos, ...incomodos])].filter(
    (t) => t !== "",
  )
}

describe.each(Object.entries(cenariosComPausa))("cenário com pausa %s", (nome, c) => {
  it("não deixa texto da pessoa, nome ou id de alimento, incômodo ou variante em span, métrica, log ou resumo", async () => {
    const runtime = createScriptedRuntime(c.roteiro)
    const { contaId, deps } = await montarCenario(c, { runtime })
    const rodada = await rodarCenario(deps, contaId, c)
    const etapas = await deps.stores.runs.etapas(contaId, rodada.final.run_id)

    const telemetria = normalizar(
      JSON.stringify({
        spans: deps.telemetry.spans,
        metricas: deps.telemetry.metricas,
        logs: deps.telemetry.logs,
        eventos: deps.telemetry.eventos,
      }),
    )
    const resumos = normalizar(etapas.map((e) => e.resumo ?? "").join(" | "))

    const termos = termosProibidos(c, rodada.perguntas)
    expect(termos.length).toBeGreaterThan(0)
    for (const termo of termos) {
      expect(telemetria, `${nome} · telemetria · "${termo}"`).not.toContain(termo)
      expect(resumos, `${nome} · resumo de etapa · "${termo}"`).not.toContain(termo)
    }
  })

  it("o resumo de cada etapa de pergunta é só a contagem, come ou variante", async () => {
    const runtime = createScriptedRuntime(c.roteiro)
    const { contaId, deps } = await montarCenario(c, { runtime })
    const rodada = await rodarCenario(deps, contaId, c)
    const etapas = await deps.stores.runs.etapas(contaId, rodada.final.run_id)

    const perguntas = etapas.filter((e) => e.tipo === "pergunta")
    expect(perguntas.length, `${nome} · etapas de pergunta`).toBe(rodada.perguntas.length)
    for (const etapa of perguntas) {
      expect(etapa.resumo ?? "", `${nome} · etapa ${etapa.nome}`).toMatch(RESUMO_DA_PERGUNTA)
    }
  })
})
