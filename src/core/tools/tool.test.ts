import { describe, expect, it } from "vitest"
import { z } from "zod"
import { definirTool } from "@/core/tools/tool"

describe("definirTool", () => {
  it("passa adiante o resumir da definição", () => {
    const tool = definirTool({
      name: "contar",
      description: "Conta algo.",
      input: z.object({}),
      output: z.object({ n: z.number() }),
      resumir: (s) => `ok ${s.n}`,
      executar: () => ({ n: 2 }),
    })

    expect(tool.resumir?.({ n: 2 })).toBe("ok 2")
  })

  it("deixa resumir ausente quando a definição não o tem", () => {
    const tool = definirTool({
      name: "contar",
      description: "Conta algo.",
      input: z.object({}),
      output: z.object({ n: z.number() }),
      executar: () => ({ n: 2 }),
    })

    expect(tool.resumir).toBeUndefined()
    expect("resumir" in tool).toBe(false)
  })
})
