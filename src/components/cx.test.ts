import { describe, expect, it } from "vitest"
import { cx } from "@/components/cx"

describe("cx", () => {
  it("retorna string vazia sem partes", () => {
    expect(cx()).toBe("")
  })

  it("ignora false, null e undefined", () => {
    expect(cx("a", false, null, undefined, "b")).toBe("a b")
  })

  it("ignora partes vazias sem sobrar espaço nas pontas", () => {
    expect(cx("", "a")).toBe("a")
  })

  it("mantém classes já compostas por espaço", () => {
    expect(cx("a b", "c")).toBe("a b c")
  })
})
