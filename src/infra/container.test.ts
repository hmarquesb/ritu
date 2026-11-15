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

  it("createContainer aceita stores e tx de teste e devolve os mesmos objetos", async () => {
    const { createContainer } = await import("./container")
    const { createMemoryStores } = await import("@/infra/fakes/memory-stores")
    const fake = createMemoryStores(createFixedClock("2026-01-15T12:00:00Z"))

    const container = createContainer({ stores: fake, tx: fake })

    expect(container.stores).toBe(fake)
    expect(container.tx).toBe(fake)
  })

  it("criar o container e ler stores não lê DATABASE_URL; a primeira consulta é que falha sem ela", async () => {
    const urlAnterior = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      const { createContainer } = await import("./container")
      const { MissingEnvError } = await import("@/core/errors")

      const container = createContainer()
      expect(() => container.stores).not.toThrow()
      expect(() => container.tx).not.toThrow()

      await expect(container.stores.accounts.buscar("x")).rejects.toThrow(MissingEnvError)
    } finally {
      if (urlAnterior !== undefined) process.env.DATABASE_URL = urlAnterior
    }
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
  it("sem OTEL_EXPORTER_OTLP_ENDPOINT, telemetry é a nula e o SDK de Node não é carregado", async () => {
    const anterior = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    const carregou = vi.fn()
    vi.doMock("@opentelemetry/sdk-node", () => {
      carregou()
      return {}
    })
    try {
      const { createContainer } = await import("./container")
      const { createNullTelemetry } = await import("./otel/null-telemetry")

      const container = createContainer()

      expect(container.telemetry.traceparentAtual()).toBeUndefined()
      expect(container.telemetry).toBe(container.telemetry)
      expect(Object.keys(container.telemetry).sort()).toEqual(
        Object.keys(createNullTelemetry()).sort(),
      )
      expect(carregou).not.toHaveBeenCalled()
    } finally {
      vi.doUnmock("@opentelemetry/sdk-node")
      if (anterior !== undefined) process.env.OTEL_EXPORTER_OTLP_ENDPOINT = anterior
    }
  })

  it("com o endpoint, telemetry é a do OTel; createContainer aceita override", async () => {
    const anterior = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318"
    try {
      const { createContainer } = await import("./container")
      const { createNullTelemetry } = await import("./otel/null-telemetry")
      const otel = await import("./otel/telemetry")
      const espiao = vi.spyOn(otel, "createOtelTelemetry")

      const container = createContainer()
      expect(container.telemetry).toBe(container.telemetry)
      expect(espiao).toHaveBeenCalledTimes(1)

      const fake = createNullTelemetry()
      expect(createContainer({ telemetry: fake }).telemetry).toBe(fake)
    } finally {
      if (anterior === undefined) delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      else process.env.OTEL_EXPORTER_OTLP_ENDPOINT = anterior
    }
  })

  it("encerrar chama telemetry.encerrar e fecha o banco, sem exigir DATABASE_URL", async () => {
    const urlAnterior = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      const { createContainer } = await import("./container")
      const { createNullTelemetry } = await import("./otel/null-telemetry")
      const telemetry = createNullTelemetry()
      const encerrar = vi.spyOn(telemetry, "encerrar")

      await createContainer({ telemetry }).encerrar()

      expect(encerrar).toHaveBeenCalledTimes(1)
    } finally {
      if (urlAnterior !== undefined) process.env.DATABASE_URL = urlAnterior
    }
  })
})
