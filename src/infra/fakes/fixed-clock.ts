import type { Clock } from "@/core/clock"

export function createFixedClock(iso: string): Clock & {
  advance(ms: number): void
  set(iso: string): void
} {
  let current = new Date(iso).getTime()

  return {
    now: () => new Date(current),
    advance(ms: number) {
      current += ms
    },
    set(next: string) {
      current = new Date(next).getTime()
    },
  }
}
