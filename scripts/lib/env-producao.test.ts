import { describe, expect, it } from "vitest"
import { ENV_VARS } from "@/infra/env"
import { linhasDoEnvProducao, nomesEmProducao } from "./env-producao"

const OBRIGATORIAS_DE_PRODUCAO = [
  "DATABASE_URL",
  "GEMINI_API_KEY",
  "AUTH_SECRET",
  "IP_HMAC_SECRET",
  "CRON_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "OTEL_EXPORTER_OTLP_HEADERS",
  "CONTATO_PRIVACIDADE",
]

function linhaDe(linhas: string[], nome: string): string {
  const linha = linhas.find((item) => item.startsWith(`${nome} `))
  if (linha === undefined) throw new Error(`sem linha para ${nome}`)
  return linha
}

describe("nomesEmProducao", () => {
  it("aceita o alvo como lista e como texto", () => {
    const resposta = {
      envs: [
        { key: "DATABASE_URL", target: ["production", "preview"], value: "x" },
        { key: "GEMINI_API_KEY", target: "production", value: "y" },
      ],
    }
    expect(nomesEmProducao(resposta)).toEqual(["DATABASE_URL", "GEMINI_API_KEY"])
  })

  it("ignora variáveis só de preview ou sem alvo", () => {
    const resposta = {
      envs: [
        { key: "AUTH_SECRET", target: "preview" },
        { key: "CRON_SECRET", target: ["development"] },
        { key: "IP_HMAC_SECRET" },
      ],
    }
    expect(nomesEmProducao(resposta)).toEqual([])
  })

  it("resposta malformada vira erro", () => {
    expect(() => nomesEmProducao({ foo: 1 })).toThrow()
    expect(() => nomesEmProducao({ envs: [{ target: "production" }] })).toThrow()
    expect(() => nomesEmProducao(undefined)).toThrow()
  })
})

describe("linhasDoEnvProducao", () => {
  it("código 0 quando as obrigatórias estão e a proibida não", () => {
    const { codigo, linhas } = linhasDoEnvProducao(ENV_VARS, OBRIGATORIAS_DE_PRODUCAO)
    expect(codigo).toBe(0)
    expect(linhaDe(linhas, "DATABASE_URL")).toMatch(/presente$/)
  })

  it("código 1 e 'ausente' quando falta obrigatória", () => {
    const nomes = OBRIGATORIAS_DE_PRODUCAO.filter((nome) => nome !== "DATABASE_URL")
    const { codigo, linhas } = linhasDoEnvProducao(ENV_VARS, nomes)
    expect(codigo).toBe(1)
    expect(linhaDe(linhas, "DATABASE_URL")).toMatch(/ausente$/)
  })

  it("código 1 e 'proibida' quando RITU_MODO está em produção", () => {
    const { codigo, linhas } = linhasDoEnvProducao(ENV_VARS, [
      ...OBRIGATORIAS_DE_PRODUCAO,
      "RITU_MODO",
    ])
    expect(codigo).toBe(1)
    expect(linhaDe(linhas, "RITU_MODO")).toMatch(/proibida$/)
  })

  it("código 1 e 'ausente' quando CONTATO_PRIVACIDADE falta em produção", () => {
    const nomes = OBRIGATORIAS_DE_PRODUCAO.filter((nome) => nome !== "CONTATO_PRIVACIDADE")
    const { codigo, linhas } = linhasDoEnvProducao(ENV_VARS, nomes)
    expect(codigo).toBe(1)
    expect(linhaDe(linhas, "CONTATO_PRIVACIDADE")).toMatch(/ausente$/)
  })

  it("opcional ausente aparece como ausente, sem derrubar o código", () => {
    const { codigo, linhas } = linhasDoEnvProducao(ENV_VARS, OBRIGATORIAS_DE_PRODUCAO)
    expect(codigo).toBe(0)
    expect(linhaDe(linhas, "TESTER_IDS")).toMatch(/ausente$/)
  })

  it("variáveis só locais ou posta pela CI mostram o traço", () => {
    const { linhas } = linhasDoEnvProducao(ENV_VARS, OBRIGATORIAS_DE_PRODUCAO)
    expect(linhaDe(linhas, "VERCEL_TOKEN")).toMatch(/—$/)
    expect(linhaDe(linhas, "RITU_VERSAO")).toMatch(/—$/)
  })

  it("nenhuma linha traz valor", () => {
    const resposta = {
      envs: OBRIGATORIAS_DE_PRODUCAO.map((key) => ({
        key,
        target: "production",
        value: `valor-secreto-de-${key}`,
      })),
    }
    const nomes = nomesEmProducao(resposta)
    const { linhas } = linhasDoEnvProducao(ENV_VARS, nomes)
    const texto = linhas.join("\n")
    expect(texto).not.toContain("valor-secreto")
    expect(texto).not.toMatch(/https?:\/\//)
  })
})
