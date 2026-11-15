import { afterAll, beforeAll, describe } from "vitest"
import { createDbClient, type DbClient } from "@/infra/db/client"
import { migrate } from "@/infra/db/migrate"
import { createPgStores } from "@/infra/db/stores"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { accountsContract } from "../contracts/accounts.contract"
import { type ContractEnv, contractStoreOpts } from "../contracts/env"
import { pantryContract } from "../contracts/pantry.contract"
import { preferencesContract } from "../contracts/preferences.contract"
import { profilesContract } from "../contracts/profiles.contract"
import { shortagesContract } from "../contracts/shortages.contract"

const URL_DO_BANCO = process.env.DATABASE_URL ?? "postgres://ritu:ritu@localhost:5432/ritu"
const SCHEMA = "ritu_test"
const INICIO = "2026-01-15T12:00:00.000Z"

let cliente: DbClient

// Schema próprio do teste: recriado no início, com as migrações aplicadas.
beforeAll(async () => {
  const admin = createDbClient({ url: URL_DO_BANCO })
  try {
    await admin.sql.unsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE; CREATE SCHEMA ${SCHEMA}`)
  } finally {
    await admin.close()
  }
  cliente = createDbClient({ url: URL_DO_BANCO, schema: SCHEMA })
  await migrate(cliente.sql, createFixedClock(INICIO))
}, 60_000)

afterAll(async () => {
  await cliente?.close()
})

// Esvazia todas as tabelas do schema de teste, menos o controle de migrações.
async function truncarTudo(): Promise<void> {
  const tabelas = await cliente.sql<{ tablename: string }[]>`
    select tablename from pg_tables
    where schemaname = ${SCHEMA} and tablename <> '_migracoes'`
  if (tabelas.length === 0) return
  const nomes = tabelas.map((t) => `"${SCHEMA}"."${t.tablename}"`).join(", ")
  await cliente.sql.unsafe(`truncate ${nomes} cascade`)
}

// O transactor só entra na T7: as suítes desta área não o usam.
const transactorNaoFeito = {
  emTransacao: () => Promise.reject(new Error("não implementado")),
}

function make(): ContractEnv {
  const clock = createFixedClock(INICIO)
  return {
    stores: createPgStores(cliente.sql, clock, contractStoreOpts),
    tx: transactorNaoFeito,
    clock,
    reset: truncarTudo,
  }
}

describe("stores Postgres", () => {
  accountsContract(make)
  profilesContract(make)
  pantryContract(make)
  shortagesContract(make)
  preferencesContract(make)
})
