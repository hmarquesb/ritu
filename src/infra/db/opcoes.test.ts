import { describe, expect, it } from "vitest"
import { opcoesDoPostgres } from "./opcoes"

describe("opcoesDoPostgres", () => {
  it("desliga prepared statements no pooler do Neon", () => {
    expect(
      opcoesDoPostgres("postgresql://u:p@ep-x-pooler.sa-east-1.aws.neon.tech/db?sslmode=require"),
    ).toEqual({ prepare: false })
  })

  it("não mexe na URL direta do Neon", () => {
    expect(
      opcoesDoPostgres("postgresql://u:p@ep-x.sa-east-1.aws.neon.tech/db?sslmode=require"),
    ).toEqual({})
  })

  it("não mexe no Postgres local", () => {
    expect(opcoesDoPostgres("postgres://localhost:5432/ritu")).toEqual({})
  })

  it("URL inválida devolve vazio", () => {
    expect(opcoesDoPostgres("nao é url")).toEqual({})
  })

  it("pooler sem hífen antes não conta", () => {
    expect(opcoesDoPostgres("postgres://u:p@pooler.exemplo.com/db")).toEqual({})
  })
})
