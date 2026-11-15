import type { StatusRun } from "./ports"

const TRANSICOES: Record<StatusRun, readonly StatusRun[]> = {
  running: ["waiting_for_input", "waiting_for_approval", "done", "failed", "cancelled"],
  waiting_for_input: ["running", "expired", "cancelled"],
  waiting_for_approval: ["done", "expired"],
  done: [],
  failed: [],
  expired: [],
  cancelled: [],
}

export function podeIr(de: StatusRun, para: StatusRun): boolean {
  return TRANSICOES[de].includes(para)
}
