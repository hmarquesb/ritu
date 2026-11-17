import { describe, expect, it, vi } from "vitest"
import type { Container } from "@/infra/container"
import { descarregarDepois } from "./descarregar"

function falso(ligada: boolean) {
  const encerrar = vi.fn(async () => {})
  return {
    container: { telemetriaLigada: ligada, telemetry: { encerrar } } as unknown as Container,
    encerrar,
  }
}

describe("descarregarDepois", () => {
  it("ligada: agenda uma vez e o agendado chama encerrar uma vez", async () => {
    const { container, encerrar } = falso(true)
    const agendar = vi.fn()
    descarregarDepois(container, agendar)
    expect(agendar).toHaveBeenCalledTimes(1)
    expect(encerrar).not.toHaveBeenCalled()
    await agendar.mock.calls[0]?.[0]?.()
    expect(encerrar).toHaveBeenCalledTimes(1)
  })

  it("nula: não agenda", () => {
    const { container } = falso(false)
    const agendar = vi.fn()
    descarregarDepois(container, agendar)
    expect(agendar).not.toHaveBeenCalled()
  })
})
