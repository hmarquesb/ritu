import { afterEach, describe, expect, it, vi } from "vitest"
import { createFixedClock } from "@/infra/fakes/fixed-clock"

afterEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
})

describe("container", () => {
  it("getContainer devolve sempre a mesma instância", async () => {
    const { getContainer } = await import("./container")

    expect(getContainer()).toBe(getContainer())
  })

  it("createContainer aceita um relógio de teste", async () => {
    const { createContainer } = await import("./container")

    const container = createContainer({ clock: createFixedClock("2026-01-15T12:00:00Z") })

    expect(container.clock.now().toISOString()).toBe("2026-01-15T12:00:00.000Z")
  })

  it("createContainer usa a configuração da aplicação por padrão", async () => {
    const { createContainer } = await import("./container")

    expect(createContainer().config.app.name).toBe("Ritu")
  })

  it("importar o módulo não lê process.env", async () => {
    vi.resetModules()
    const original = process.env
    let reads = 0
    process.env = new Proxy(original, {
      get(target, key, receiver) {
        reads++
        return Reflect.get(target, key, receiver)
      },
    })

    try {
      await import("./container")
    } finally {
      process.env = original
    }

    expect(reads).toBe(0)
  })
})
