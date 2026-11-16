import { describe, expect, it } from "vitest"
import { executarLimpeza } from "@/core/cleanup"
import { textosDaConversa } from "@/core/conversation/textos"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { cenariosDeGuardrails, montarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Uma frase por padrão de alerta (src/core/guardrails/padroes.ts): emocional e físico.
const EMOCIONAIS = [
  "queria sumir",
  "pensei em suicídio",
  "não quero mais viver",
  "não vale a pena viver",
  "sem motivo pra viver",
  "seria melhor se eu sumisse",
  "não aguento mais.",
]

const FISICOS = [
  "tô com uma dor forte no peito",
  "tô com falta de ar",
  "desmaiei agora há pouco",
  "febre alta desde ontem",
  "febre de 39",
  "estou com 40 graus de febre",
  "vomitei sangue",
  "uma dor insuportável",
  "tive uma convulsão",
]

function base(): CenarioDeConversa {
  const c = cenariosDeGuardrails["alerta-por-codigo"]
  if (!c) throw new Error("cenário de guardrail ausente: alerta-por-codigo")
  return c
}

async function montar(texto: string) {
  const c: CenarioDeConversa = { ...base(), mensagem: { texto, atalhos: [] } }
  const llm = createFakeLlm([])
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { llm, runtime })
  const resposta = await deps.conversation.conversar(contaId, c.mensagem)
  const run = await deps.stores.runs.buscar(contaId, resposta.run_id)
  return { c, contaId, deps, llm, runtime, resposta, run }
}

type Montado = Awaited<ReturnType<typeof montar>>

function contou(m: Montado, resultado: string): boolean {
  return m.deps.telemetry.metricas.some(
    (x) =>
      x.nome === "ritu_guardrail_total" &&
      x.rotulos.resultado === resultado &&
      x.rotulos.origem === "codigo",
  )
}

describe.each(EMOCIONAIS)("alerta emocional por código: %s", (texto) => {
  it("vai ao caminho alerta com o texto fixo, sem modelo e sem tool", async () => {
    const m = await montar(texto)
    expect(m.run?.caminho).toBe("alerta")
    expect(m.resposta.saida?.resposta).toBe(textosDaConversa.alertaEmocional)
    expect(m.llm.pedidos).toHaveLength(0)
    expect(m.runtime.pedidos).toHaveLength(0)
  })

  it("registra o guardrail por código com o resultado alerta_emocional", async () => {
    expect(contou(await montar(texto), "alerta_emocional")).toBe(true)
  })

  it("marca as mensagens do run com incômodo e não anota nada", async () => {
    const m = await montar(texto)
    expect(m.run?.com_incomodo).toBe(true)
    expect(m.resposta.saida?.anotacoes).toEqual([])
    expect(await m.deps.stores.proposals.doRun(m.contaId, m.resposta.run_id)).toEqual([])
    expect(await m.deps.stores.profiles.evitarTemporario(m.contaId, m.run?.dia ?? "")).toEqual([])
    expect(await m.deps.stores.pantry.listar(m.contaId)).toHaveLength(m.c.casa.length)
  })
})

describe.each(FISICOS)("alerta físico por código: %s", (texto) => {
  it("vai ao caminho alerta com o texto fixo, sem modelo e sem tool", async () => {
    const m = await montar(texto)
    expect(m.run?.caminho).toBe("alerta")
    expect(m.resposta.saida?.resposta).toBe(textosDaConversa.alertaFisico)
    expect(m.llm.pedidos).toHaveLength(0)
    expect(m.runtime.pedidos).toHaveLength(0)
  })

  it("registra o guardrail por código com o resultado alerta_fisico", async () => {
    expect(contou(await montar(texto), "alerta_fisico")).toBe(true)
  })

  it("marca as mensagens do run com incômodo e não anota nada", async () => {
    const m = await montar(texto)
    expect(m.run?.com_incomodo).toBe(true)
    expect(m.resposta.saida?.anotacoes).toEqual([])
    expect(await m.deps.stores.proposals.doRun(m.contaId, m.resposta.run_id)).toEqual([])
    expect(await m.deps.stores.profiles.evitarTemporario(m.contaId, m.run?.dia ?? "")).toEqual([])
    expect(await m.deps.stores.pantry.listar(m.contaId)).toHaveLength(m.c.casa.length)
  })
})

describe("alerta por código: as mensagens somem no dia seguinte", () => {
  it.each([...EMOCIONAIS, ...FISICOS])(
    "a limpeza do dia seguinte apaga as mensagens de %s",
    async (texto) => {
      const m = await montar(texto)
      const dia = m.run?.dia ?? ""
      const doDia = await m.deps.stores.messages.doDia(m.contaId, dia)
      expect(doDia.map((x) => x.autor).sort()).toEqual(["agente", "pessoa"])
      expect(doDia.every((x) => x.com_incomodo)).toBe(true)

      // 12h em São Paulo do dia seguinte.
      m.deps.clock.set("2026-06-16T15:00:00.000Z")
      await executarLimpeza({
        stores: m.deps.stores,
        clock: m.deps.clock,
        ledger: m.deps.ledger,
        limiter: createMemoryLimiter(),
      })

      expect(await m.deps.stores.messages.doDia(m.contaId, dia)).toEqual([])
    },
  )
})
