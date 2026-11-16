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

  it("routine e patterns existem sem abrir o banco e usam as deps do container", async () => {
    const urlAnterior = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      const { createContainer } = await import("./container")
      const { createMemoryStores, createMemoryLedger } = await import("@/infra/fakes/memory-stores")
      const { createFakeLlm } = await import("@/infra/fakes/fake-llm")
      const clock = createFixedClock("2026-01-15T12:00:00Z")
      const fake = createMemoryStores(clock)

      const semBanco = createContainer({ clock })
      expect(() => semBanco.routine).not.toThrow()
      expect(() => semBanco.patterns).not.toThrow()
      expect(semBanco.routine).toBe(semBanco.routine)
      expect(semBanco.patterns).toBe(semBanco.patterns)

      const container = createContainer({
        clock,
        stores: fake,
        tx: fake,
        ledger: createMemoryLedger(clock),
        llm: createFakeLlm([]),
        knowledge: createMiniKnowledge(),
      })
      await expect(container.routine.atualizarResumo("conta-1")).resolves.toMatchObject({
        origem: "vazio",
        gravou: false,
      })
      await expect(container.patterns.detectarPadroesDaConta("conta-1")).resolves.toBe(0)
    } finally {
      if (urlAnterior !== undefined) process.env.DATABASE_URL = urlAnterior
    }
  })

  it("ledger existe sem abrir o banco e aceita override", async () => {
    const { createContainer } = await import("./container")
    const { createMemoryLedger } = await import("@/infra/fakes/memory-stores")
    const urlAnterior = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      expect(() => createContainer().ledger).not.toThrow()
      const fake = createMemoryLedger(createFixedClock("2026-01-15T12:00:00Z"))
      expect(createContainer({ ledger: fake }).ledger).toBe(fake)
    } finally {
      if (urlAnterior !== undefined) process.env.DATABASE_URL = urlAnterior
    }
  })

  it("router e llm existem sem ler GEMINI_API_KEY e aceitam override", async () => {
    const { createContainer } = await import("./container")
    const { createFakeLlm } = await import("@/infra/fakes/fake-llm")
    const { createMemoryLedger } = await import("@/infra/fakes/memory-stores")
    const chaveAnterior = process.env.GEMINI_API_KEY
    delete process.env.GEMINI_API_KEY
    try {
      const container = createContainer({
        ledger: createMemoryLedger(createFixedClock("2026-01-15T12:00:00Z")),
      })
      expect(() => container.llm).not.toThrow()
      expect(container.llm).toBe(container.llm)
      expect(typeof container.router.paraPapel).toBe("function")
      const fake = createFakeLlm([])
      expect(createContainer({ llm: fake }).llm).toBe(fake)
      const router = container.router
      expect(createContainer({ router }).router).toBe(router)
    } finally {
      if (chaveAnterior !== undefined) process.env.GEMINI_API_KEY = chaveAnterior
    }
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

  it("runtime e runs são preguiçosos: sem GEMINI_API_KEY nem DATABASE_URL, criar não lança", async () => {
    const chave = process.env.GEMINI_API_KEY
    const url = process.env.DATABASE_URL
    delete process.env.GEMINI_API_KEY
    delete process.env.DATABASE_URL
    try {
      const { createContainer } = await import("./container")
      const container = createContainer()
      expect(container.runtime).toBe(container.runtime)
      expect(typeof container.runtime.passo).toBe("function")
      expect(container.runs).toBe(container.runs)
    } finally {
      if (chave !== undefined) process.env.GEMINI_API_KEY = chave
      if (url !== undefined) process.env.DATABASE_URL = url
    }
  })

  it("runtime e runs aceitam override", async () => {
    const { createContainer } = await import("./container")
    const { createScriptedRuntime } = await import("./fakes/scripted-runtime")
    const runtime = createScriptedRuntime([])
    const runs = {} as ReturnType<typeof createContainer>["runs"]
    const container = createContainer({ runtime, runs })
    expect(container.runtime).toBe(runtime)
    expect(container.runs).toBe(runs)
  })

  it("companion é preguiçoso: sem GEMINI_API_KEY nem DATABASE_URL, criar não lança e a instância é a mesma", async () => {
    const chave = process.env.GEMINI_API_KEY
    const url = process.env.DATABASE_URL
    delete process.env.GEMINI_API_KEY
    delete process.env.DATABASE_URL
    try {
      const { createContainer } = await import("./container")
      const container = createContainer()
      expect(container.companion).toBe(container.companion)
    } finally {
      if (chave !== undefined) process.env.GEMINI_API_KEY = chave
      if (url !== undefined) process.env.DATABASE_URL = url
    }
  })

  it("companion aceita override", async () => {
    const { createContainer } = await import("./container")
    const companion = {} as ReturnType<typeof createContainer>["companion"]
    const container = createContainer({ companion })
    expect(container.companion).toBe(companion)
  })

  it("interpreter e conversation são preguiçosos: sem GEMINI_API_KEY nem DATABASE_URL, criar não lança e a instância é a mesma", async () => {
    const chave = process.env.GEMINI_API_KEY
    const url = process.env.DATABASE_URL
    delete process.env.GEMINI_API_KEY
    delete process.env.DATABASE_URL
    try {
      const { createContainer } = await import("./container")
      const container = createContainer()
      expect(container.interpreter).toBe(container.interpreter)
      expect(container.conversation).toBe(container.conversation)
    } finally {
      if (chave !== undefined) process.env.GEMINI_API_KEY = chave
      if (url !== undefined) process.env.DATABASE_URL = url
    }
  })

  it("interpreter e conversation aceitam override", async () => {
    const { createContainer } = await import("./container")
    const interpreter = {} as ReturnType<typeof createContainer>["interpreter"]
    const conversation = {} as ReturnType<typeof createContainer>["conversation"]
    const container = createContainer({ interpreter, conversation })
    expect(container.interpreter).toBe(interpreter)
    expect(container.conversation).toBe(conversation)
  })

  it("judge é preguiçoso: sem GEMINI_API_KEY nem DATABASE_URL, criar não lança e a instância é a mesma", async () => {
    const chave = process.env.GEMINI_API_KEY
    const url = process.env.DATABASE_URL
    delete process.env.GEMINI_API_KEY
    delete process.env.DATABASE_URL
    try {
      const { createContainer } = await import("./container")
      const container = createContainer()
      expect(() => container.judge).not.toThrow()
      expect(container.judge).toBeDefined()
      expect(container.judge).toBe(container.judge)
    } finally {
      if (chave !== undefined) process.env.GEMINI_API_KEY = chave
      if (url !== undefined) process.env.DATABASE_URL = url
    }
  })

  it("judge aceita override", async () => {
    const { createContainer } = await import("./container")
    const { createApprovingJudge } = await import("./fakes/fake-judge")
    const judge = createApprovingJudge()
    const container = createContainer({ judge })
    expect(container.judge).toBe(judge)
  })

  it("iniciarTelemetria sem endpoint não carrega o SDK de Node", async () => {
    const anterior = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    const carregou = vi.fn()
    vi.doMock("@opentelemetry/sdk-node", () => {
      carregou()
      return {}
    })
    try {
      const { createContainer } = await import("./container")
      await createContainer().iniciarTelemetria()
      expect(carregou).not.toHaveBeenCalled()
    } finally {
      vi.doUnmock("@opentelemetry/sdk-node")
      if (anterior !== undefined) process.env.OTEL_EXPORTER_OTLP_ENDPOINT = anterior
    }
  })

  it("com endpoint, iniciarTelemetria inicia o SDK uma vez só e encerrar o encerra", async () => {
    const anterior = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    const nextRuntime = process.env.NEXT_RUNTIME
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318"
    delete process.env.NEXT_RUNTIME
    const encerrarSdk = vi.fn().mockResolvedValue(undefined)
    const iniciar = vi.fn(() => ({ encerrar: encerrarSdk }))
    vi.doMock("@/infra/otel/node-sdk", () => ({ iniciarOtelNode: iniciar }))
    try {
      const { createContainer } = await import("./container")
      const { createNullTelemetry } = await import("./otel/null-telemetry")
      const container = createContainer({ telemetry: createNullTelemetry() })

      await container.iniciarTelemetria()
      await container.iniciarTelemetria()
      expect(iniciar).toHaveBeenCalledTimes(1)
      expect(encerrarSdk).not.toHaveBeenCalled()

      await container.encerrar()
      expect(encerrarSdk).toHaveBeenCalledTimes(1)
    } finally {
      vi.doUnmock("@/infra/otel/node-sdk")
      if (anterior === undefined) delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      else process.env.OTEL_EXPORTER_OTLP_ENDPOINT = anterior
      if (nextRuntime !== undefined) process.env.NEXT_RUNTIME = nextRuntime
    }
  })

  it("limiter e demoSeed são preguiçosos: criar não abre o banco nem lê seed/", async () => {
    const url = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    const carregar = vi.fn(() => ({ marca: "seed" }))
    vi.doMock("@/infra/knowledge/yaml-seed", () => ({ loadDemoSeed: carregar }))
    try {
      const { createContainer } = await import("./container")
      const container = createContainer()
      expect(() => container.limiter).not.toThrow()
      expect(carregar).not.toHaveBeenCalled()
      expect(container.demoSeed).toBe(container.demoSeed)
      expect(carregar).toHaveBeenCalledTimes(1)
    } finally {
      vi.doUnmock("@/infra/knowledge/yaml-seed")
      if (url !== undefined) process.env.DATABASE_URL = url
    }
  })

  describe("modo e2e", () => {
    afterEach(() => {
      vi.unstubAllEnvs()
      delete (globalThis as { __rituContainerE2e?: unknown }).__rituContainerE2e
    })

    it("usa os fakes em memória e getContainer devolve a mesma instância", async () => {
      vi.stubEnv("RITU_MODO", "e2e")
      vi.stubEnv("VERCEL_ENV", "")
      const { createContainer, getContainer } = await import("./container")
      const container = createContainer()

      expect(container.stores).toBe(container.tx)
      expect(container.stores).toBe(container.stores)
      expect(container.limiter).toBe(container.limiter)
      expect(container.telemetry.traceparentAtual()).toBeUndefined()
      await expect(container.stores.accounts.buscar("x")).resolves.toBeUndefined()
      expect(getContainer()).toBe(getContainer())
      expect(getContainer()).toBe(
        (globalThis as { __rituContainerE2e?: unknown }).__rituContainerE2e,
      )
    })

    it("recusa em produção", async () => {
      vi.stubEnv("RITU_MODO", "e2e")
      vi.stubEnv("VERCEL_ENV", "production")
      const { createContainer } = await import("./container")

      expect(() => createContainer()).toThrow(
        expect.objectContaining({ code: "modo_e2e_em_producao" }),
      )
    })

    it("outro valor de RITU_MODO é ignorado: adaptadores reais", async () => {
      vi.stubEnv("RITU_MODO", "outro")
      vi.stubEnv("DATABASE_URL", "")
      const { createContainer } = await import("./container")
      const container = createContainer()
      await expect(container.stores.accounts.buscar("x")).rejects.toThrow()
    })
  })
})
