import { describe, expect, it } from "vitest"
import { envStatus } from "@/infra/env"
import { formatEnvStatus } from "./env-report"

const SEGREDO = "segredo-123"
const URL_COM_SENHA = "postgres://u:senha@h/db"

function statusCom(presentes: Record<string, string>) {
  return envStatus(presentes)
}

describe("formatEnvStatus", () => {
  it("nunca expõe valor, trecho ou tamanho de variável", () => {
    const { lines } = formatEnvStatus(
      statusCom({ GEMINI_API_KEY: SEGREDO, DATABASE_URL: URL_COM_SENHA }),
      1,
    )
    const texto = lines.join("\n")

    expect(texto).not.toContain(SEGREDO)
    expect(texto).not.toContain("senha")
    expect(texto).not.toContain("postgres://")
    expect(texto).not.toContain("11")
  })

  it("tem uma linha por variável do catálogo, com presente ou ausente", () => {
    const { lines } = formatEnvStatus(
      statusCom({ GEMINI_API_KEY: SEGREDO, DATABASE_URL: URL_COM_SENHA }),
    )
    const linhasDeVariavel = lines.filter((linha) => /presente|ausente/.test(linha))

    expect(linhasDeVariavel).toHaveLength(20)
    const gemini = linhasDeVariavel.find((linha) => linha.includes("GEMINI_API_KEY"))
    const auth = linhasDeVariavel.find((linha) => linha.includes("AUTH_SECRET"))
    expect(gemini).toMatch(/GEMINI_API_KEY\s+presente\s+entrega 1\s+obrigatória/)
    expect(auth).toMatch(/AUTH_SECRET\s+ausente\s+entrega 3\s+obrigatória/)
  })

  it("com entrega 1 retorna 1 quando GEMINI_API_KEY está ausente", () => {
    const { exitCode } = formatEnvStatus(statusCom({ DATABASE_URL: URL_COM_SENHA }), 1)
    expect(exitCode).toBe(1)
  })

  it("com entrega 1 retorna 1 quando DATABASE_URL está ausente", () => {
    const { exitCode } = formatEnvStatus(statusCom({ GEMINI_API_KEY: SEGREDO }), 1)
    expect(exitCode).toBe(1)
  })

  it("com entrega 1 retorna 0 quando as duas obrigatórias estão presentes", () => {
    const { exitCode } = formatEnvStatus(
      statusCom({ GEMINI_API_KEY: SEGREDO, DATABASE_URL: URL_COM_SENHA }),
      1,
    )
    expect(exitCode).toBe(0)
  })

  it("com entrega 3 retorna 1 quando AUTH_SECRET está ausente", () => {
    const { exitCode } = formatEnvStatus(
      statusCom({
        GEMINI_API_KEY: SEGREDO,
        DATABASE_URL: URL_COM_SENHA,
        IP_HMAC_SECRET: SEGREDO,
        CRON_SECRET: SEGREDO,
      }),
      3,
    )
    expect(exitCode).toBe(1)
  })

  it("sem entrega retorna 0 mesmo com tudo ausente", () => {
    const { exitCode } = formatEnvStatus(statusCom({}))
    expect(exitCode).toBe(0)
  })

  it("com falta, termina com a lista de nomes obrigatórios faltantes", () => {
    const { lines, exitCode } = formatEnvStatus(statusCom({}), 1)
    expect(exitCode).toBe(1)
    expect(lines.at(-1)).toBe("Faltam para a entrega 1: DATABASE_URL, GEMINI_API_KEY")
  })
})
