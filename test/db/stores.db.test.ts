import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createPgBastidores } from "@/infra/db/bastidores"
import { createDbClient, type DbClient } from "@/infra/db/client"
import { createPgLimiter } from "@/infra/db/limits"
import { migrate } from "@/infra/db/migrate"
import { createPgStores } from "@/infra/db/stores"
import { createPgTransactor } from "@/infra/db/transactor"
import { createPgUsageLedger } from "@/infra/db/usage-ledger"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { accountsContract } from "../contracts/accounts.contract"
import { bastidoresContract } from "../contracts/bastidores.contract"
import { deleteAccountContract } from "../contracts/delete-account.contract"
import { type ContractEnv, contractStoreOpts, criarDuasContas } from "../contracts/env"
import { runLimitsContract } from "../contracts/limits.contract"
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
import { runUsageLedgerContract } from "../contracts/usage-ledger.contract"

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
  bastidoresContract(() => {
    const env = make()
    return { ...env, bastidores: createPgBastidores(cliente.sql) }
  })
})

runUsageLedgerContract("Postgres", (clock) => ({
  ledger: createPgUsageLedger(cliente.sql, clock),
  limpar: truncarTudo,
}))

runLimitsContract(
  "Postgres",
  async () => ({ limiter: createPgLimiter(cliente.sql), reset: truncarTudo }),
  { concorrencia: true },
)

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
      tipo: "tool",
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

describe("migração 0005 (padrões de chá)", () => {
  it("converte as chaves de chá, junta duplicadas e reescreve a frase, sem mexer no resto", async () => {
    const schemaMig = "ritu_test_mig5"
    const antes = join(process.cwd(), "test", "db", "fixtures-0005")
    const clock = createFixedClock(INICIO)
    await cliente.sql.unsafe(
      `DROP SCHEMA IF EXISTS ${schemaMig} CASCADE; CREATE SCHEMA ${schemaMig}`,
    )
    await rm(antes, { recursive: true, force: true })
    await mkdir(antes, { recursive: true })
    const cli = createDbClient({ url: URL_DO_BANCO, schema: schemaMig })
    try {
      const todas = (await readdir(join(process.cwd(), "db", "migrations")))
        .filter((nome) => nome.endsWith(".sql"))
        .sort()
      for (const nome of todas.filter((n) => n < "0005")) {
        await copyFile(join(process.cwd(), "db", "migrations", nome), join(antes, nome))
      }
      await migrate(cli.sql, clock, antes)

      const [ra] = await cli.sql<
        { id: string }[]
      >`insert into contas (tipo, email, tester, criado_em) values ('google', 'a@teste.dev', false, now()) returning id`
      const a = { id: ra?.id ?? "" }
      const [rb] = await cli.sql<
        { id: string }[]
      >`insert into contas (tipo, email, tester, criado_em) values ('google', 'b@teste.dev', false, now()) returning id`
      const b = { id: rb?.id ?? "" }
      const linhas: [string, string, string, number, string, string, string | null][] = [
        [
          a.id,
          "ajuda_em_estado",
          "com_frio+agitada|pratica:cha-gengibre-canela",
          3,
          "confirmado",
          "2026-01-05T10:00:00Z",
          "2026-01-10T10:00:00Z",
        ],
        [
          a.id,
          "ajuda_em_estado",
          "com_frio+agitada|pratica:cha-louro",
          2,
          "candidato",
          "2026-01-03T10:00:00Z",
          null,
        ],
        [
          a.id,
          "ajuda_em_estado",
          "seca|preparo:sopa",
          4,
          "candidato",
          "2026-01-04T10:00:00Z",
          null,
        ],
        [a.id, "estados_juntos", "com_frio+agitada", 5, "candidato", "2026-01-04T10:00:00Z", null],
        [
          b.id,
          "ajuda_em_estado",
          "pesada+seca+irritada|pratica:cha-hortela",
          1,
          "recusado",
          "2026-01-06T10:00:00Z",
          "2026-01-07T10:00:00Z",
        ],
        [
          b.id,
          "ajuda_em_estado",
          "pesada+seca+irritada|pratica:cha-erva-doce",
          2,
          "candidato",
          "2026-01-02T10:00:00Z",
          null,
        ],
      ]
      for (const [conta, tipo, chave, oc, status, criado, decidido] of linhas) {
        await cli.sql`insert into padroes (conta_id, tipo, chave, frase, ocorrencias, status, criado_em, decidido_em)
          values (${conta}, ${tipo}, ${chave}, 'antiga', ${oc}, ${status}, ${criado}, ${decidido})`
      }

      // As migrações depois da 0005 também entram; a 0005 é a primeira a rodar sobre os dados antigos.
      const aplicadas = await migrate(cli.sql, clock)
      expect(aplicadas[0]).toBe(todas.find((n) => n.startsWith("0005")) ?? "")

      const lidas =
        await cli.sql`select conta_id, tipo, chave, frase, ocorrencias, status, criado_em, decidido_em
        from padroes order by conta_id, tipo, chave`
      const daConta = (id: string) => lidas.filter((l) => l.conta_id === id)
      const cha = daConta(a.id).filter((l) => l.chave.endsWith("|cha"))
      expect(cha).toHaveLength(1)
      expect(cha[0]).toMatchObject({
        chave: "com_frio+agitada|cha",
        frase: "Quando você está com frio e agitada, um chá costuma te ajudar.",
        ocorrencias: 5,
        status: "confirmado",
      })
      expect(new Date(cha[0]?.criado_em).toISOString()).toBe("2026-01-03T10:00:00.000Z")
      expect(new Date(cha[0]?.decidido_em).toISOString()).toBe("2026-01-10T10:00:00.000Z")
      expect(
        daConta(a.id)
          .map((l) => l.chave)
          .sort(),
      ).toEqual(["com_frio+agitada", "com_frio+agitada|cha", "seca|preparo:sopa"])
      expect(daConta(a.id).find((l) => l.chave === "seca|preparo:sopa")).toMatchObject({
        frase: "antiga",
        ocorrencias: 4,
      })
      const outra = daConta(b.id)
      expect(outra).toHaveLength(1)
      expect(outra[0]).toMatchObject({
        chave: "pesada+seca+irritada|cha",
        frase: "Quando você está pesada, seca e irritada, um chá costuma te ajudar.",
        ocorrencias: 3,
        status: "recusado",
      })
      expect(new Date(outra[0]?.criado_em).toISOString()).toBe("2026-01-02T10:00:00.000Z")
    } finally {
      await cli.close()
      await rm(antes, { recursive: true, force: true })
    }
  })
})
