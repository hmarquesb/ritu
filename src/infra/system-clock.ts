import type { Clock } from "@/core/clock"

export const systemClock: Clock = {
  now: () => new Date(),
}
