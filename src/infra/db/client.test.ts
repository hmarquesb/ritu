import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { MissingEnvError, RituError } from "@/core/errors"
import { createDbClient, isConnectionError, toDbError } from "./client"

const TABELAS = [
  "contas",
  "perfis",
  "evitar_temporario",
  "casa",
  "alimentos_desconhecidos",
  "preferencias",
  "retornos",
  "rotina_notas",
  "rotina_resumos",
  "padroes",
  "mensagens",
  "runs",
  "run_etapas",
  "propostas",
  "faltas",
  "lista_ter_em_casa",
  "feedback",
]

const URL_DO_BANCO = "postgres://ritu:ritu@localhost:5432/ritu"

let urlAnterior: string | undefined

beforeEach(() => {
  urlAnterior = process.env.DATABASE_URL
  delete process.env.DATABASE_URL
})

afterEach(() => {
  if (urlAnterior === undefined) {
    delete process.env.DATABASE_URL
  } else {
    process.env.DATABASE_URL = urlAnterior
  }
})

function erroDeConexao(codigo: string, mensagem: string): Error {
  return Object.assign(new Error(mensagem), { code: codigo })
}

describe("cliente preguiçoso", () => {
  it("criar o cliente não lê DATABASE_URL nem abre conexão", async () => {
    const db = createDbClient()

    expect(db.sql).toBeDefined()
    await expect(db.close()).resolves.toBeUndefined()
  })

  it("a primeira consulta sem DATABASE_URL falha com env_ausente", () => {
    const db = createDbClient()

    expect(() => db.sql`select 1`).toThrow(MissingEnvError)
    return db.close()
  })
})

describe("erros de conexão", () => {
  it("reconhece ECONNREFUSED, ENOTFOUND e os CONNECTION_*", () => {
    expect(isConnectionError(erroDeConexao("ECONNREFUSED", "x"))).toBe(true)
    expect(isConnectionError(erroDeConexao("ENOTFOUND", "x"))).toBe(true)
    expect(isConnectionError(erroDeConexao("CONNECTION_CLOSED", "x"))).toBe(true)
    expect(isConnectionError(erroDeConexao("CONNECTION_ENDED", "x"))).toBe(true)
    expect(isConnectionError(new Error("outro"))).toBe(false)
  })

  it("toDbError de conexão recusada vira banco_indisponivel sem a URL na mensagem", () => {
    const erro = toDbError(erroDeConexao("ECONNREFUSED", `connect ECONNREFUSED ${URL_DO_BANCO}`))

    expect(erro).toBeInstanceOf(RituError)
    expect((erro as RituError).code).toBe("banco_indisponivel")
    expect(erro.message).toBe("Banco indisponível")
    expect(erro.message).not.toContain("postgres://")
  })

  it("toDbError devolve sem mudar um erro que não é de conexão", () => {
    const original = new Error("violação qualquer")

    expect(toDbError(original)).toBe(original)
  })
})

describe("migração inicial (db/migrations/0001_inicial.sql)", () => {
  const sql = readFileSync(join(process.cwd(), "db", "migrations", "0001_inicial.sql"), "utf8")

  it("cria exatamente as 17 tabelas da spec", () => {
    const criadas = [...sql.matchAll(/create table (?:if not exists )?(\w+)\s*\(/gi)].map(
      (m) => m[1],
    )

    expect(criadas).toHaveLength(17)
    expect([...criadas].sort()).toEqual([...TABELAS].sort())
  })

  it("não usa now() nem default de tempo: o tempo vem do código", () => {
    expect(sql).not.toMatch(/\bnow\s*\(/i)
    expect(sql).not.toMatch(/default\s+current_timestamp/i)
  })

  it("não tem coluna de texto de incômodo", () => {
    expect(sql).not.toMatch(/\b(?!com_)\w*incomodo\w*\s+text\b/i)
  })
})
