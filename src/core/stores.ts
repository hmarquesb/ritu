import type { AccountRepository, ProfileStore } from "./accounts/ports"
import type { MessageRepository } from "./messages/ports"
import type { OutcomeStore } from "./outcomes/ports"
import type { PantryStore } from "./pantry/ports"
import type { PatternStore } from "./patterns/ports"
import type { PreferenceStore } from "./preferences/ports"
import type { ProposalStore } from "./proposals/ports"
import type { RoutineStore } from "./routine/ports"
import type { RunRepository } from "./runs/ports"
import type { ShortageStore } from "./shortages/ports"

export type Stores = {
  accounts: AccountRepository
  profiles: ProfileStore
  pantry: PantryStore
  preferences: PreferenceStore
  outcomes: OutcomeStore
  shortages: ShortageStore
  routine: RoutineStore
  patterns: PatternStore
  messages: MessageRepository
  runs: RunRepository
  proposals: ProposalStore
}

export interface Transactor {
  emTransacao<T>(fn: (stores: Stores) => Promise<T>): Promise<T>
}
