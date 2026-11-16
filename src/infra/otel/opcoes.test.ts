import { afterEach, describe, expect, it, vi } from "vitest"
import { opcoesDoOtel } from "./opcoes"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe("opcoesDoOtel", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("o recurso tem service.name e service.instance.id em formato uuid", () => {
    vi.stubEnv("OTEL_SERVICE_NAME", "")
    const { resource } = opcoesDoOtel({ intervaloMs: 5000 })
    expect(resource.attributes["service.name"]).toBe("ritu")
    expect(String(resource.attributes["service.instance.id"])).toMatch(UUID)
  })

  it("usa OTEL_SERVICE_NAME e mantém o mesmo instance.id dentro do processo (id do módulo)", () => {
    vi.stubEnv("OTEL_SERVICE_NAME", "outro")
    const a = opcoesDoOtel({ intervaloMs: 5000 }).resource.attributes
    const b = opcoesDoOtel({ intervaloMs: 5000 }).resource.attributes
    expect(a["service.name"]).toBe("outro")
    expect(a["service.instance.id"]).toBe(b["service.instance.id"])
  })

  it("o leitor de métricas usa o intervalo pedido", async () => {
    const { metricReader } = opcoesDoOtel({ intervaloMs: 1234 })
    // biome-ignore lint/suspicious/noExplicitAny: campo interno do leitor
    expect((metricReader as any)._exportInterval).toBe(1234)
    await metricReader.shutdown().catch(() => undefined)
  })
})
