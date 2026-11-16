import { describe, expect, it } from "vitest"
import { cenarios, montarCenario, rodarCenario } from "../../../test/fixtures/cenarios"
import { createMemoryTelemetry } from "./memory-telemetry"
import { createTeeTelemetry } from "./tee-telemetry"

function montar() {
  const memoria = createMemoryTelemetry()
  const outra = createMemoryTelemetry()
  return { memoria, outra, tee: createTeeTelemetry(memoria, outra) }
}

describe("createTeeTelemetry", () => {
  it("span aninhado aparece nos dois com o pai certo", async () => {
    const { memoria, outra, tee } = montar()
    await tee.span("run", {}, async () => {
      await tee.span("agente.passo", {}, async () => {})
    })
    for (const t of [memoria, outra]) {
      expect(t.spans.map((s) => s.nome)).toEqual(["run", "agente.passo"])
      expect(t.spans[1]?.pai).toBe(0)
    }
  })

  it("atribuir e falhar do span ativo chegam aos dois", async () => {
    const { memoria, outra, tee } = montar()
    await tee.span("run", {}, async (s) => {
      s.atribuir({ "run.status": "completed" })
      s.falhar("x")
    })
    for (const t of [memoria, outra]) {
      expect(t.spans[0]?.atributos["run.status"]).toBe("completed")
      expect(t.spans[0]?.falha).toBe("x")
    }
  })

  it("atribuirAoSpanAtual chega aos dois", async () => {
    const { memoria, outra, tee } = montar()
    await tee.span("run", {}, async () => {
      tee.atribuirAoSpanAtual({ "run.caminho": "agente" })
    })
    expect(memoria.spans[0]?.atributos["run.caminho"]).toBe("agente")
    expect(outra.spans[0]?.atributos["run.caminho"]).toBe("agente")
  })

  it("métrica com rótulo inválido lança e não chega à outra", () => {
    const { outra, tee } = montar()
    expect(() => tee.contador("ritu_llm_chamadas_total", { modelo: "m" })).toThrow(
      /rotulos_invalidos/,
    )
    expect(outra.metricas).toHaveLength(0)
  })

  it("traceparentAtual vem da outra", async () => {
    const { outra, tee } = montar()
    let visto: string | undefined
    await tee.span("run", {}, async () => {
      visto = tee.traceparentAtual()
    })
    expect(visto).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/)
    expect(outra.spans[0]?.trace).toBe(visto?.split("-")[1])
  })

  it("log dentro de run ganha run.id nos dois", async () => {
    const { memoria, outra, tee } = montar()
    await tee.span("run", { "run.id": "r1" }, async () => {
      tee.log("run_inicio", { "run.id": "r1" })
    })
    for (const t of [memoria, outra]) expect(t.logs[0]?.campos["run.id"]).toBe("r1")
  })

  it("montarCenario com telemetria repassa o span run à outra", async () => {
    const outra = createMemoryTelemetry()
    const c = Object.values(cenarios)[0]
    if (!c) throw new Error("sem cenário")
    const { contaId, deps } = await montarCenario(c, { telemetria: outra })
    await rodarCenario(deps, contaId, c)
    expect(outra.spans.some((s) => s.nome === "run")).toBe(true)
    expect(deps.telemetry.spans.some((s) => s.nome === "run")).toBe(true)
  })
})
