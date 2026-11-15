import type { Stores, Transactor } from "@/core/stores"
import type { createFixedClock } from "@/infra/fakes/fixed-clock"

export type FixedClock = ReturnType<typeof createFixedClock>

export type ContractEnv = {
  stores: Stores
  tx: Transactor
  clock: FixedClock
  reset?: () => Promise<void>
}

/** Um id que a base de alimentos não conhece. */
export const ALIMENTO_INEXISTENTE = "alimento-inexistente"

/** Opções que todo runner passa ao montar os stores. */
export const contractStoreOpts = {
  alimentoExiste: (id: string) => id !== ALIMENTO_INEXISTENTE,
}

/** Duas contas Google distintas, para os testes de autorização por conta. */
export async function criarDuasContas(stores: Stores): Promise<{ a: string; b: string }> {
  const a = await stores.accounts.criar({
    tipo: "google",
    google_sub: "sub-conta-a",
    email: "a@exemplo.com",
  })
  const b = await stores.accounts.criar({
    tipo: "google",
    google_sub: "sub-conta-b",
    email: "b@exemplo.com",
  })
  return { a: a.id, b: b.id }
}
