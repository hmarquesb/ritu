import type { Clock } from "@/core/clock"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Stores, Transactor } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"

export type Deps = {
  tx: Transactor
  stores: Stores
  kb: KnowledgeBase
  clock: Clock
  telemetry: Telemetry
}
