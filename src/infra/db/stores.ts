import type { Clock } from "@/core/clock"
import type { Stores } from "@/core/stores"
import { createPgAccounts } from "./accounts"
import { toDbError } from "./errors"
import type { Conexao } from "./mappers"
import { createPgMessages } from "./messages"
import { createPgOutcomes } from "./outcomes"
import { createPgPantry, type OpcoesPantry } from "./pantry"
import { createPgPatterns } from "./patterns"
import { createPgPreferences } from "./preferences"
import { createPgProfiles } from "./profiles"
import { createPgProposals } from "./proposals"
import { createPgRoutine } from "./routine"
import { createPgRuns } from "./runs"
import { createPgShortages } from "./shortages"

// Erro de conexão do driver vira RituError sem a URL; os demais passam sem mudança.
function protegerErros<T extends object>(porta: T): T {
  const protegida = Object.entries(porta).map(([nome, metodo]) => [
    nome,
    async (...args: unknown[]) => {
      try {
        return await (metodo as (...a: unknown[]) => unknown)(...args)
      } catch (erro) {
        throw toDbError(erro)
      }
    },
  ])
  return Object.fromEntries(protegida) as T
}

export function createPgStores(sql: Conexao, clock: Clock, opts: OpcoesPantry = {}): Stores {
  return {
    accounts: protegerErros(createPgAccounts(sql, clock)),
    profiles: protegerErros(createPgProfiles(sql, clock)),
    pantry: protegerErros(createPgPantry(sql, clock, opts)),
    preferences: protegerErros(createPgPreferences(sql, clock)),
    shortages: protegerErros(createPgShortages(sql, clock)),
    outcomes: protegerErros(createPgOutcomes(sql, clock)),
    routine: protegerErros(createPgRoutine(sql, clock)),
    patterns: protegerErros(createPgPatterns(sql, clock)),
    messages: protegerErros(createPgMessages(sql, clock)),
    runs: protegerErros(createPgRuns(sql, clock)),
    proposals: protegerErros(createPgProposals(sql, clock)),
  }
}
