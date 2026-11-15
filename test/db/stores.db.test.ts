import { mkdir, readdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createDbClient, type DbClient } from "@/infra/db/client"
import { migrate } from "@/infra/db/migrate"
import { createPgStores } from "@/infra/db/stores"
import { createPgTransactor } from "@/infra/db/transactor"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { accountsContract } from "../contracts/accounts.contract"
import { deleteAccountContract } from "../contracts/delete-account.contract"
import { type ContractEnv, contractStoreOpts, criarDuasContas } from "../contracts/env"
import { messagesContract } from "../contracts/messages.contract"
import { outcomesContract } from "../contracts/outcomes.contract"
import { pantryContract } from "../contracts/pantry.contract"
import { patternsContract } from "../contracts/patterns.contract"
import { preferencesContract } from "../contracts/preferences.contract"
import { profilesContract } from "../contracts/profiles.contract"
import { proposalsContract } from "../contracts/proposals.contract"
import { routineContract } from "../contracts/routine.contract"
import { runsContract } from "../contracts/runs.contract"
import { shortagesContract } from "../contracts/shortages.contract"
import { transactorContract } from "../contracts/transactor.contract"

const URL_DO_BANCO = process.env.DATABASE_URL ?? "postgres://ritu:ritu@localhost:5432/ritu"
const SCHEMA = "ritu_test"
const INICIO = "2026-01-15T12:00:00.000Z"
const DIA = "2026-01-15"

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

function make(): ContractEnv {
  const clock = createFixedClock(INICIO)
  return {
    stores: createPgStores(cliente.sql, clock, contractStoreOpts),
    tx: createPgTransactor(cliente.sql, clock, contractStoreOpts),
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
  outcomesContract(make)
  routineContract(make)
  patternsContract(make)
  messagesContract(make)
  runsContract(make)
  proposalsContract(make)
  transactorContract(make)
  deleteAccountContract(make)
})

// Efeitos que nenhuma porta devolve: conferidos com SQL direto.
describe("efeitos no banco", () => {
  it("accounts.apagar anonimiza os runs e tira o resumo das etapas", async () => {
    const env = make()
    await truncarTudo()
    const { a } = await criarDuasContas(env.stores)
    const run = await env.stores.runs.criar(a, { caminho: "casa", intencoes: [], dia: DIA })
    await env.stores.runs.atualizar(a, run.id, {
      status: "waiting_for_input",
      saida: { texto: "oi" },
      checkpoint: { passo: 1 },
      pendencia: { tipo: "x" },
      clima_usado: { temp: 20 },
    })
    await env.stores.runs.acrescentarEtapa(a, run.id, {
      tipo: "ferramenta",
      nome: "casa.ler",
      resumo: "dados da casa",
      status: "ok",
      duracao_ms: 5,
      modelo: null,
      tokens_entrada: 0,
      tokens_saida: 0,
    })

    await env.stores.accounts.apagar(a)

    const [anonimizado] = await cliente.sql`
      select conta_id, saida, checkpoint, pendencia, clima_usado from runs where id = ${run.id}`
    expect(anonimizado).toEqual({
      conta_id: null,
      saida: null,
      checkpoint: null,
      pendencia: null,
      clima_usado: null,
    })
    const etapas = await cliente.sql`select resumo from run_etapas where run_id = ${run.id}`
    expect(etapas.map((e) => e.resumo)).toEqual([null])
    const contas = await cliente.sql`select id from contas where id = ${a}`
    expect(contas).toEqual([])
  })

  it("runs.votar grava uma linha em feedback e, chamado de novo, atualiza o voto", async () => {
    const env = make()
    await truncarTudo()
    const { a } = await criarDuasContas(env.stores)
    const run = await env.stores.runs.criar(a, { caminho: "casa", intencoes: [], dia: DIA })

    await env.stores.runs.votar(a, run.id, "up")
    const primeiro = await cliente.sql`select voto from feedback where run_id = ${run.id}`
    expect(primeiro.map((f) => f.voto)).toEqual(["up"])

    await env.stores.runs.votar(a, run.id, "down")
    const segundo = await cliente.sql`select voto from feedback where run_id = ${run.id}`
    expect(segundo.map((f) => f.voto)).toEqual(["down"])
  })
})

describe("migrate", () => {
  it("é idempotente e registra em _migracoes as migrações de db/migrations, em ordem de nome", async () => {
    const aplicadasAgora = await migrate(cliente.sql, createFixedClock(INICIO))
    expect(aplicadasAgora).toEqual([])

    const registradas = await cliente.sql<{ nome: string }[]>`
      select nome from _migracoes order by nome`
    const arquivos = (await readdir(join(process.cwd(), "db", "migrations")))
      .filter((nome) => nome.endsWith(".sql"))
      .sort()
    expect(registradas.map((linha) => linha.nome)).toEqual(arquivos)
  })

  it("aplica as pendentes em ordem de nome e, rodando de novo, não aplica nada", async () => {
    const schemaMig = "ritu_test_mig"
    const fixtures = join(process.cwd(), "test", "db", "fixtures")
    const pasta = join(fixtures, "migracoes")
    await cliente.sql.unsafe(
      `DROP SCHEMA IF EXISTS ${schemaMig} CASCADE; CREATE SCHEMA ${schemaMig}`,
    )
    await rm(pasta, { recursive: true, force: true })
    await mkdir(pasta, { recursive: true })
    const cliMig = createDbClient({ url: URL_DO_BANCO, schema: schemaMig })
    try {
      await writeFile(join(pasta, "0001_a.sql"), "create table a (id int);")
      await writeFile(join(pasta, "0002_b.sql"), "create table b (id int);")
      const clock = createFixedClock(INICIO)

      expect(await migrate(cliMig.sql, clock, pasta)).toEqual(["0001_a.sql", "0002_b.sql"])
      expect(await migrate(cliMig.sql, clock, pasta)).toEqual([])
    } finally {
      await cliMig.close()
      await rm(fixtures, { recursive: true, force: true })
    }
  })
})
