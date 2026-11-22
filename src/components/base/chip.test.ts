import { describe, expect, it, vi } from "vitest"
import { pendingChipProps } from "@/components/base/chip"

describe("pendingChipProps", () => {
  it("pendente: não dispara onChange e expõe data-pending e aria-busy", () => {
    const onChange = vi.fn()
    const props = pendingChipProps(true, onChange)
    props.onChange?.(true)
    expect(onChange).not.toHaveBeenCalled()
    expect(props["data-pending"]).toBe(true)
    expect(props["aria-busy"]).toBe(true)
  })

  it("não pendente: repassa o onChange e não marca o chip", () => {
    const onChange = vi.fn()
    const props = pendingChipProps(false, onChange)
    props.onChange?.(true)
    expect(onChange).toHaveBeenCalledWith(true)
    expect(props["data-pending"]).toBeUndefined()
    expect(props["aria-busy"]).toBeUndefined()
  })
})
