import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it, vi } from "vitest"
import { MissingEnvError } from "@/core/errors"
import { ENV_VARS, envStatus, optionalEnv, requireEnv } from "./env"

const ENV_EXAMPLE = fileURLToPath(new URL("../../.env.example", import.meta.url))

describe("RITU_MODO", () => {
  const variavel = ENV_VARS.find((item) => item.name === "RITU_MODO")

  it("está no catálogo, opcional, da entrega 3, então o check da entrega 3 não falha sem ela", () => {
    expect(variavel).toMatchObject({ name: "RITU_MODO", entrega: 3, obrigatoria: false })
  })
})

const VALORES_DE_EXEMPLO = new Set([
  "DATABASE_URL",
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "OTEL_SERVICE_NAME",
])

describe("requireEnv", () => {
  it.each([
    ["ausente", {}],
    ["vazia", { X: "" }],
    ["só espaços", { X: "   " }],
  ])("lança MissingEnvError quando a variável está %s", (_, env) => {
    expect(() => requireEnv("X", env)).toThrow(MissingEnvError)
    expect(() => requireEnv("X", env)).toThrow("Defina X no .env.local")
  })

  it("devolve o valor quando a variável está definida", () => {
    expect(requireEnv("X", { X: "v" })).toBe("v")
  })
})

describe("optionalEnv", () => {
  it("devolve undefined para variável vazia ou ausente", () => {
    expect(optionalEnv("X", { X: "" })).toBeUndefined()
    expect(optionalEnv("X", { X: "  " })).toBeUndefined()
    expect(optionalEnv("X", {})).toBeUndefined()
  })

  it("devolve o valor quando a variável está definida", () => {
    expect(optionalEnv("X", { X: "v" })).toBe("v")
  })
})

describe("envStatus", () => {
  const status = envStatus({ DATABASE_URL: "x", EXTRA: "y" })

  it("lista só as variáveis do catálogo, sem as de fora", () => {
    expect(status).toHaveLength(12)
    expect(status.map((item) => item.name)).not.toContain("EXTRA")
  })

  it("marca presença pelo valor, não pelo nome", () => {
    const porNome = Object.fromEntries(status.map((item) => [item.name, item.presente]))

    expect(porNome.DATABASE_URL).toBe(true)
    expect(porNome.GEMINI_API_KEY).toBe(false)
  })

  it("segue a ordem do catálogo e expõe entrega e obrigatoriedade", () => {
    expect(status.map((item) => item.name)).toEqual(ENV_VARS.map((v) => v.name))
    expect(status[0]).toEqual({
      name: "DATABASE_URL",
      entrega: 1,
      obrigatoria: true,
      presente: true,
    })
  })

  it("trata string só com espaços como ausente", () => {
    const porNome = Object.fromEntries(
      envStatus({ DATABASE_URL: "   " }).map((item) => [item.name, item.presente]),
    )

    expect(porNome.DATABASE_URL).toBe(false)
  })
})

describe(".env.example", () => {
  const linhas = readFileSync(ENV_EXAMPLE, "utf8").split("\n")
  const variaveis = linhas
    .filter((linha) => linha.trim() !== "" && !linha.startsWith("#"))
    .map((linha) => {
      const cortePrimeiro = linha.indexOf("=")
      return {
        name: linha.slice(0, cortePrimeiro),
        valor: linha.slice(cortePrimeiro + 1),
      }
    })

  it("tem os nomes do catálogo, na mesma ordem", () => {
    expect(variaveis.map((v) => v.name)).toEqual(ENV_VARS.map((v) => v.name))
  })

  it("tem comentário de uma linha antes de cada variável", () => {
    const indicesDeVariavel = linhas
      .map((linha, indice) => ({ linha, indice }))
      .filter(({ linha }) => linha.includes("=") && !linha.startsWith("#"))
      .map(({ indice }) => indice)

    for (const indice of indicesDeVariavel) {
      expect(linhas[indice - 1]?.startsWith("#")).toBe(true)
    }
  })

  it("só tem valor nas três variáveis de exemplo", () => {
    const comValor = variaveis.filter((v) => v.valor !== "").map((v) => v.name)

    expect(comValor.sort()).toEqual([...VALORES_DE_EXEMPLO].sort())
  })
})

describe("importação de env.ts", () => {
  it("não lê process.env ao ser importado", async () => {
    const original = process.env
    const acessos = vi.fn()
    process.env = new Proxy({} as NodeJS.ProcessEnv, {
      get: (_, chave) => {
        acessos(chave)
        return undefined
      },
      has: () => {
        acessos("has")
        return false
      },
    })

    try {
      vi.resetModules()
      await import("./env")

      expect(acessos).not.toHaveBeenCalled()
    } finally {
      process.env = original
    }
  })
})
