import { describe, expect, it } from "vitest"
import { accountsContract } from "../../../test/contracts/accounts.contract"
import { deleteAccountContract } from "../../../test/contracts/delete-account.contract"
import { contractStoreOpts } from "../../../test/contracts/env"
import { messagesContract } from "../../../test/contracts/messages.contract"
import { outcomesContract } from "../../../test/contracts/outcomes.contract"
import { pantryContract } from "../../../test/contracts/pantry.contract"
import { patternsContract } from "../../../test/contracts/patterns.contract"
import { preferencesContract } from "../../../test/contracts/preferences.contract"
import { profilesContract } from "../../../test/contracts/profiles.contract"
import { proposalsContract } from "../../../test/contracts/proposals.contract"
import { routineContract } from "../../../test/contracts/routine.contract"
import { runsContract } from "../../../test/contracts/runs.contract"
import { shortagesContract } from "../../../test/contracts/shortages.contract"
import { transactorContract } from "../../../test/contracts/transactor.contract"
import { runUsageLedgerContract } from "../../../test/contracts/usage-ledger.contract"
import { createFixedClock } from "./fixed-clock"
import { createMemoryLedger, createMemoryStores } from "./memory-stores"

function ambiente() {
  const clock = createFixedClock("2026-01-15T12:00:00Z")
  const fake = createMemoryStores(clock, contractStoreOpts)
  return { stores: fake, tx: fake, clock }
}

accountsContract(() => ambiente())
profilesContract(() => ambiente())
pantryContract(() => ambiente())
shortagesContract(() => ambiente())
preferencesContract(() => ambiente())
outcomesContract(() => ambiente())
routineContract(() => ambiente())
patternsContract(() => ambiente())
messagesContract(() => ambiente())
runsContract(() => ambiente())
proposalsContract(() => ambiente())
transactorContract(() => ambiente())
deleteAccountContract(() => ambiente())
runUsageLedgerContract("memória", (clock) => ({ ledger: createMemoryLedger(clock) }))

describe("createMemoryStores: comportamento próprio do fake", () => {
  it("transação com erro desfaz as escritas feitas dentro dela", async () => {
    const { stores, tx } = ambiente()

    await expect(
      tx.emTransacao(async (s) => {
        await s.accounts.criar({ tipo: "google", google_sub: "sub-transitoria" })
        throw new Error("falhou no meio")
      }),
    ).rejects.toThrow("falhou no meio")

    expect(await stores.accounts.buscarPorGoogleSub("sub-transitoria")).toBeUndefined()
  })

  it("transação sem erro mantém as escritas", async () => {
    const { stores, tx } = ambiente()

    await tx.emTransacao(async (s) => {
      await s.accounts.criar({ tipo: "google", google_sub: "sub-definitiva" })
    })

    expect(await stores.accounts.buscarPorGoogleSub("sub-definitiva")).toMatchObject({
      google_sub: "sub-definitiva",
    })
  })
})
