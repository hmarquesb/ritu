import { afterEach, describe, expect, it, vi } from "vitest"
import { createFakeCities } from "@/infra/fakes/fake-cities"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"

// Conta só leituras feitas pelo código do Ritu (src/ ou config/), não pelas bibliotecas.
function lidaPeloRitu(): boolean {
  const chamador = (new Error().stack ?? "")
    .split("\n")
    .filter((linha) => linha.trim().startsWith("at "))
    .find((linha) => !linha.includes("container.test.ts"))
  return (
    chamador !== undefined &&
    /\/(src|config)\//.test(chamador) &&
    !chamador.includes("node_modules")
  )
}

afterEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
  vi.doUnmock("@/infra/knowledge/yaml-knowledge")
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
    // Dependências externas são pré-carregadas: a leitura interna delas não é do Ritu.
    await import("@/infra/knowledge/yaml-knowledge")
    vi.resetModules()
    const original = process.env
    let reads = 0
    process.env = new Proxy(original, {
      get(target, key, receiver) {
        if (lidaPeloRitu()) reads++
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

  it("createContainer não carrega data/; o primeiro acesso a knowledge carrega uma vez", async () => {
    const load = vi.fn(() => createMiniKnowledge())
    vi.doMock("@/infra/knowledge/yaml-knowledge", () => ({ loadKnowledgeBase: load }))
    const { createContainer } = await import("./container")

    const container = createContainer()
    expect(load).not.toHaveBeenCalled()

    expect(container.knowledge).toBe(container.knowledge)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it("createContainer aceita uma fonte de clima e de cidades de teste", async () => {
    const { createContainer } = await import("./container")
    const weather = createFakeWeather()
    const cities = createFakeCities()

    const container = createContainer({ weather, cities })

    expect(container.weather).toBe(weather)
    expect(container.cities).toBe(cities)
  })

  it("criar o container e ler weather e cities não chama fetch", async () => {
    const { createContainer } = await import("./container")
    const espiao = vi.fn(async () => new Response("{}", { status: 500 }))
    vi.stubGlobal("fetch", espiao)

    const container = createContainer()
    expect(container.weather).toBe(container.weather)
    expect(container.cities).toBe(container.cities)
    expect(typeof container.weather.buscar).toBe("function")

    expect(espiao).not.toHaveBeenCalled()
  })

  it("createContainer aceita uma base de conhecimento de teste", async () => {
    const { createContainer } = await import("./container")

    const container = createContainer({ knowledge: createMiniKnowledge() })

    expect(container.knowledge.alimento("banana")?.id).toBe("banana")
  })

  it("closeDatabase sem conexão aberta resolve sem exigir DATABASE_URL", async () => {
    const urlAnterior = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      const { closeDatabase } = await import("./container")

      await expect(closeDatabase()).resolves.toBeUndefined()
    } finally {
      if (urlAnterior !== undefined) process.env.DATABASE_URL = urlAnterior
    }
  })

  it("migrateDatabase sem DATABASE_URL falha com env_ausente só na hora de migrar", async () => {
    const urlAnterior = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      const { migrateDatabase } = await import("./container")
      const { MissingEnvError } = await import("@/core/errors")

      await expect(migrateDatabase()).rejects.toThrow(MissingEnvError)
    } finally {
      if (urlAnterior !== undefined) process.env.DATABASE_URL = urlAnterior
    }
  })
})
