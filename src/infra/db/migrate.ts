import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import type { Sql } from "postgres"
import type { Clock } from "@/core/clock"
import { toDbError } from "./errors"

const CRIAR_CONTROLE = `
create table if not exists _migracoes (
  nome text primary key,
  aplicada_em timestamptz not null
)`

// Aplica, em ordem de nome, cada migração de db/migrations/ que ainda não foi registrada.
// Cada migração roda na sua transação junto com o registro. Devolve os nomes aplicados agora.
export async function migrate(
  sql: Sql,
  clock: Clock,
  dir: string = join(process.cwd(), "db", "migrations"),
): Promise<string[]> {
  try {
    await sql.unsafe(CRIAR_CONTROLE)
    const registradas = await sql<{ nome: string }[]>`select nome from _migracoes`
    const feitas = new Set(registradas.map((linha) => linha.nome))
    const arquivos = (await readdir(dir)).filter((nome) => nome.endsWith(".sql")).sort()

    const aplicadas: string[] = []
    for (const nome of arquivos) {
      if (feitas.has(nome)) continue
      const texto = await readFile(join(dir, nome), "utf8")
      await sql.begin(async (tx) => {
        await tx.unsafe(texto)
        await tx`insert into _migracoes (nome, aplicada_em) values (${nome}, ${clock.now()})`
      })
      aplicadas.push(nome)
    }
    return aplicadas
  } catch (erro) {
    throw toDbError(erro)
  }
}
