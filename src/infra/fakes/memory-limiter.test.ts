import { runLimitsContract } from "../../../test/contracts/limits.contract"
import { createMemoryLimiter } from "./memory-limiter"

runLimitsContract("memória", async () => ({ limiter: createMemoryLimiter() }), {
  concorrencia: true,
})
