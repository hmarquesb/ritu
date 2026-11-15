import { describe, expect, it } from "vitest"
import { accountsContract } from "../../../test/contracts/accounts.contract"
import { contractStoreOpts } from "../../../test/contracts/env"
import { pantryContract } from "../../../test/contracts/pantry.contract"
import { preferencesContract } from "../../../test/contracts/preferences.contract"
import { profilesContract } from "../../../test/contracts/profiles.contract"
import { shortagesContract } from "../../../test/contracts/shortages.contract"
import { createFixedClock } from "./fixed-clock"
import { createMemoryStores } from "./memory-stores"

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
