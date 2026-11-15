import type { Clock } from "@/core/clock"
import type { Stores, Transactor } from "@/core/stores"
import { toDbError } from "./errors"
import { type Conexao, numaTransacao } from "./mappers"
import type { OpcoesPantry } from "./pantry"
import { createPgStores } from "./stores"

// Tudo o que fn escrever pelas portas entra numa transação só: se fn lança, nada fica.
export function createPgTransactor(
  sql: Conexao,
  clock: Clock,
  opts: OpcoesPantry = {},
): Transactor {
  return {
    async emTransacao<T>(fn: (stores: Stores) => Promise<T>): Promise<T> {
      try {
        return await numaTransacao(sql, (tx) => fn(createPgStores(tx, clock, opts)))
      } catch (erro) {
        throw toDbError(erro)
      }
    },
  }
}
