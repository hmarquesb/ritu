import type { Clock } from "@/core/clock"

const HORA_DO_E2E_EM_MS = (20 * 60 + 30) * 60_000

// Relógio do modo e2e: anda como o real, mas parte de 20h30 UTC (17h30 no Rio), para o momento do dia
// e os candidatos dos roteiros não mudarem com a hora em que a suíte roda.
export function createRelogioDoE2e(real: () => Date = () => new Date()): Clock {
  const inicio = real().getTime()
  const base = inicio - (inicio % 86_400_000) + HORA_DO_E2E_EM_MS
  return { now: () => new Date(base + (real().getTime() - inicio)) }
}
