import { describe, expect, it } from "vitest"
import { podeIr } from "./estados"
import type { StatusRun } from "./ports"

describe("podeIr", () => {
  it.each<[StatusRun, StatusRun]>([
    ["running", "waiting_for_input"],
    ["running", "waiting_for_approval"],
    ["running", "done"],
    ["running", "failed"],
    ["running", "cancelled"],
    ["waiting_for_input", "running"],
    ["waiting_for_input", "expired"],
    ["waiting_for_input", "cancelled"],
    ["waiting_for_approval", "done"],
    ["waiting_for_approval", "expired"],
  ])("aceita a transição %s → %s", (de, para) => {
    expect(podeIr(de, para)).toBe(true)
  })

  it.each<[StatusRun, StatusRun]>([
    ["done", "running"],
    ["waiting_for_approval", "running"],
    ["expired", "cancelled"],
    ["failed", "running"],
    ["cancelled", "done"],
    ["running", "expired"],
  ])("recusa a transição %s → %s", (de, para) => {
    expect(podeIr(de, para)).toBe(false)
  })
})
