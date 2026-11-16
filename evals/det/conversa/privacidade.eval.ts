import { describe, expect, it } from "vitest"
import { normalizar } from "@/core/knowledge/identificar"
import { getContainer } from "@/infra/container"
import {
  cenariosComAprovacao,
  cenariosComPausa,
  cenariosDeConversa,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

const kb = getContainer().knowledge

// Ids gerados (run, trace, span) são hexadecimais aleatórios: um nome de alimento pode cair dentro deles.
// Sem esses campos, a comparação só vê o que o código escreveu.
const IDS_GERADOS = new Set(["run.id", "trace_id"])
const semIds = (campos: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(campos).filter(([chave]) => !IDS_GERADOS.has(chave)))

function telemetriaDe(t: {
  spans: { nome: string; atributos: Record<string, unknown>; falha?: string }[]
  metricas: { nome: string; valor: number; rotulos: Record<string, unknown> }[]
  logs: { nivel: string; codigo: string; campos: Record<string, unknown> }[]
  eventos: { nome: string; atributos: Record<string, unknown> }[]
}): string {
  return normalizar(
    JSON.stringify({
      spans: t.spans.map((s) => ({ nome: s.nome, atributos: semIds(s.atributos), falha: s.falha })),
      metricas: t.metricas.map((m) => ({ nome: m.nome, valor: m.valor, rotulos: m.rotulos })),
      logs: t.logs.map((l) => ({ nivel: l.nivel, codigo: l.codigo, campos: semIds(l.campos) })),
      eventos: t.eventos.map((e) => ({ nome: e.nome, atributos: semIds(e.atributos) })),
    }),
  )
}

// Termos que não podem aparecer na telemetria nem nos resumos: a mensagem inteira, cada palavra
// de 5 letras ou mais e cada nome de alimento da base.
function termosProibidos(c: CenarioDeConversa): string[] {
  const texto = normalizar(c.mensagem.texto ?? "")
  const palavras = texto.split(" ").filter((p) => p.length >= 5)
  const alimentos = kb.alimentos.map((a) => normalizar(a.nome))
  return [...new Set([texto, ...palavras, ...alimentos].filter((t) => t !== ""))]
}

// Todos os cenários de conversa, com pausa e com aprovação: cada um roda até o fim do run (rodarCenario).
const TODOS: Record<string, CenarioDeConversa> = {
  ...cenariosDeConversa,
  ...cenariosComPausa,
  ...cenariosComAprovacao,
}

describe.each(Object.entries(TODOS))("cenário %s", (nome, c) => {
  it("não deixa texto da pessoa nem nome de alimento em span, métrica, log ou resumo", async () => {
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)
    const etapas = await deps.stores.runs.etapas(contaId, rodada.final.run_id)

    const telemetria = telemetriaDe(deps.telemetry)
    const resumos = normalizar(etapas.map((e) => e.resumo ?? "").join(" | "))

    expect(termosProibidos(c).length).toBeGreaterThan(0)
    for (const termo of termosProibidos(c)) {
      expect(telemetria, `${nome} · telemetria · "${termo}"`).not.toContain(termo)
      expect(resumos, `${nome} · resumo de etapa · "${termo}"`).not.toContain(termo)
    }
  })
})
