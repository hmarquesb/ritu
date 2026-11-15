import { type AppConfig, config } from "@config/index"
import type { Clock } from "@/core/clock"
import { systemClock } from "@/infra/system-clock"

export type Container = { config: AppConfig; clock: Clock }

export function createContainer(overrides?: Partial<Container>): Container {
  return {
    config,
    clock: systemClock,
    ...overrides,
  }
}

let instance: Container | undefined

export function getContainer(): Container {
  instance ??= createContainer()
  return instance
}
