import { llmCotas } from "@config/llm-cotas"
import { describe, expect, it } from "vitest"
import type { UsageLedger } from "@/core/llm/ledger"
import type { AgentRuntime } from "@/core/runs/agent-runtime"
import type { CidadeDaPessoa } from "@/core/weather/ports"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { type Cenario, cenarios, montarCenario } from "../../../test/fixtures/cenarios"

const CIDADE: CidadeDaPessoa = {
  nome: "Rio de Janeiro",
  lat: -22.91,
  lon: -43.21,
  fuso: "America/Sao_Paulo",
}

function cenario(nome: string): Cenario {
  const c = cenarios[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  return c
}

// Esgota no dia todos os modelos do papel decisão, como o registro de uso faria.
async function esgotarDecisao(ledger: UsageLedger): Promise<void> {
  for (const modelo of llmCotas.papeis.decisao) {
    for (let i = 0; i < llmCotas.rateLimitsParaEsgotarODia; i++) {
      await ledger.registrarRateLimit(modelo)
    }
  }
}

describe("clima.agora fora do ar", () => {
  it("com cidade, a tool devolve indisponível e a resposta sai do agente", async () => {
    const base = cenario("estomago-pesado")
    const c: Cenario = { ...base, perfil: { cidade: CIDADE }, clima: "fora_do_ar" }
    const { contaId, deps } = await montarCenario(c)
    const r = await deps.companion.responder(contaId, c.entrada)
    const etapas = await deps.stores.runs.etapas(contaId, r.run_id)
    const run = await deps.stores.runs.buscar(contaId, r.run_id)

    expect(etapas.find((e) => e.tipo === "tool" && e.nome === "clima.agora")?.resumo).toBe(
      "indisponível",
    )
    expect(r.status).toBe("done")
    expect(r.saida?.origem).toBe("agente")
    expect(run?.clima_usado).toBeNull()
  })
})

describe("clima.agora sem cidade", () => {
  it("a tool devolve sem cidade e a resposta sai do agente, sem clima no run", async () => {
    const c = cenario("estomago-pesado")
    const { contaId, deps } = await montarCenario(c)
    const r = await deps.companion.responder(contaId, c.entrada)
    const etapas = await deps.stores.runs.etapas(contaId, r.run_id)
    const run = await deps.stores.runs.buscar(contaId, r.run_id)

    expect(etapas.find((e) => e.tipo === "tool" && e.nome === "clima.agora")?.resumo).toBe(
      "sem cidade",
    )
    expect(r.status).toBe("done")
    expect(r.saida?.origem).toBe("agente")
    expect(run?.clima_usado).toBeNull()
  })
})

describe("sem modelo antes do loop", () => {
  it("o papel decisão esgotado no dia vira resposta montada por código, sem etapa de modelo", async () => {
    const c = cenario("sem-modelo")
    const { contaId, deps } = await montarCenario(c)
    const r = await deps.companion.responder(contaId, c.entrada)
    const etapas = await deps.stores.runs.etapas(contaId, r.run_id)
    const run = await deps.stores.runs.buscar(contaId, r.run_id)

    expect(etapas).toEqual([])
    expect(r.status).toBe("done")
    expect(r.fim).toBe("sem_modelo")
    expect(r.saida?.origem).toBe("sem_modelo")
    expect(run?.modelos).toEqual({ decisao: [] })
    expect(deps.telemetry.metricas.map((m) => m.nome)).toContain("ritu_fallback_sem_llm_total")
  })
})

describe("sem modelo durante o loop", () => {
  it("esgotado depois da primeira chamada, a segunda não tem modelo e a resposta sai por código", async () => {
    const c = cenario("frio-agitada")
    const roteiro = createScriptedRuntime(c.roteiro)
    let chamadas = 0
    const runtime: AgentRuntime = {
      async passo(pedido) {
        chamadas += 1
        const resultado = await roteiro.passo(pedido)
        // O roteador escolhe o modelo antes de cada passo: esgotar depois do primeiro deixa a segunda sem vaga.
        if (chamadas === 1) await esgotarDecisao(deps.ledger)
        return resultado
      },
    }
    const { contaId, deps } = await montarCenario(c, { runtime })
    const r = await deps.companion.responder(contaId, c.entrada)
    const etapas = await deps.stores.runs.etapas(contaId, r.run_id)

    expect(roteiro.pedidos).toHaveLength(1)
    expect(etapas.filter((e) => e.tipo === "llm")).toHaveLength(1)
    expect(r.status).toBe("done")
    expect(r.fim).toBe("sem_modelo")
    expect(r.saida?.origem).toBe("sem_modelo")
  })
})
