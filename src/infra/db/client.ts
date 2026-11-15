import postgres, { type Sql } from "postgres"
import { requireEnv } from "@/infra/env"

export { isConnectionError, toDbError } from "./errors"

export type DbClientOptions = { url?: string; schema?: string }

export type DbClient = {
  sql: Sql
  close(): Promise<void>
}

// Proxy sobre uma função: a conexão e a leitura de DATABASE_URL só acontecem na primeira consulta.
// O cast é só de tipo: a chamada e as propriedades são repassadas ao cliente real.
function preguica(obter: () => Sql): Sql {
  const alvo = () => undefined
  return new Proxy(alvo, {
    apply: (_, __, args: unknown[]) => Reflect.apply(obter(), undefined, args),
    get: (_, propriedade) => Reflect.get(obter(), propriedade),
  }) as unknown as Sql
}

export function createDbClient(opcoes: DbClientOptions = {}): DbClient {
  let real: Sql | undefined
  const obter = (): Sql => {
    real ??= postgres(opcoes.url ?? requireEnv("DATABASE_URL"), {
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => undefined, // NOTICE do Postgres (ex.: "already exists, skipping") não vai para o log
      ...(opcoes.schema ? { connection: { search_path: opcoes.schema } } : {}),
    })
    return real
  }

  return {
    sql: preguica(obter),
    async close() {
      const atual = real
      real = undefined
      await atual?.end({ timeout: 5 })
    },
  }
}
