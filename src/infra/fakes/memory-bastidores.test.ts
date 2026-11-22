import { bastidoresContract } from "../../../test/contracts/bastidores.contract"
import { contractStoreOpts } from "../../../test/contracts/env"
import { createFixedClock } from "./fixed-clock"
import { createMemoryBastidores } from "./memory-bastidores"
import { createMemoryStores } from "./memory-stores"

bastidoresContract(() => {
  const clock = createFixedClock("2026-01-15T12:00:00Z")
  const stores = createMemoryStores(clock, contractStoreOpts)
  return { stores, tx: stores, clock, bastidores: createMemoryBastidores(stores) }
})
