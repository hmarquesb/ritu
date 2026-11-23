import { describe, expect, it } from "vitest"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { medirChamadaMcp, type StatusDaTool } from "./telemetria"

const classificar = (resultado: { ok: boolean } | undefined, erro?: unknown): StatusDaTool => {
  if (erro !== undefined) return "erro"
  return resultado?.ok ? "ok" : "invalido"
}

describe("medirChamadaMcp", () => {
  it("chamada ok abre o span mcp.tool com a tool e status ok, e soma a métrica", async () => {
    const telemetry = createMemoryTelemetry()
    const r = await medirChamadaMcp(
      telemetry,
      "ayurveda.buscar",
      async () => ({ ok: true }),
      classificar,
    )
    expect(r).toEqual({ ok: true })
    expect(telemetry.spans).toHaveLength(1)
    expect(telemetry.spans[0]).toMatchObject({
      nome: "mcp.tool",
      atributos: { "tool.nome": "ayurveda.buscar", "tool.status": "ok" },
    })
    expect(telemetry.metricas).toEqual([
      {
        tipo: "contador",
        nome: "ritu_mcp_chamadas_total",
        valor: 1,
        rotulos: { tool: "ayurveda.buscar", resultado: "ok" },
      },
    ])
  })

  it("resultado classificado como inválido vai para o span e para a métrica", async () => {
    const telemetry = createMemoryTelemetry()
    await medirChamadaMcp(telemetry, "clima.agora", async () => ({ ok: false }), classificar)
    expect(telemetry.spans[0]?.atributos["tool.status"]).toBe("invalido")
    expect(telemetry.metricas[0]?.rotulos).toEqual({ tool: "clima.agora", resultado: "invalido" })
  })

  it("exceção: relança o erro, marca o span com falha e soma a métrica com erro", async () => {
    const telemetry = createMemoryTelemetry()
    await expect(
      medirChamadaMcp(
        telemetry,
        "clima.agora",
        async () => {
          throw new Error("falhou")
        },
        classificar,
      ),
    ).rejects.toThrow("falhou")
    expect(telemetry.spans[0]?.falha).toBeDefined()
    expect(telemetry.metricas[0]?.rotulos).toEqual({ tool: "clima.agora", resultado: "erro" })
  })
})
