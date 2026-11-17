import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import nextConfig from "../../next.config"
import { cronDiario, vercelConfigSchema } from "./vercel-config"

const vercelJson: unknown = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../vercel.json", import.meta.url)), "utf8"),
)

describe("vercel.json", () => {
  it("passa no schema", () => {
    expect(vercelConfigSchema.safeParse(vercelJson).success).toBe(true)
  })

  it("todo cron é diário, dentro do limite do plano Hobby", () => {
    const config = vercelConfigSchema.parse(vercelJson)
    for (const cron of config.crons) {
      expect(cronDiario(cron.schedule)).toBe(true)
    }
  })
})

describe("cronDiario", () => {
  it.each(["0 6 * * *", "0 8 * * *", "59 23 * * *", "5 0 * * *"])("aceita %s", (expr) => {
    expect(cronDiario(expr)).toBe(true)
  })

  it.each([
    "*/5 * * * *",
    "0 6 1 * *",
    "0 * * * *",
    "0 6 * * 1",
    "0 6 * *",
    "0 6 * * * *",
    "60 6 * * *",
    "0 24 * * *",
    "0 6 * 1 *",
    "",
  ])("recusa %s", (expr) => {
    expect(cronDiario(expr)).toBe(false)
  })
})

describe("vercelConfigSchema", () => {
  it("recusa chave a mais", () => {
    const comExtra = { ...(vercelJson as object), framework: "nextjs" }
    expect(vercelConfigSchema.safeParse(comExtra).success).toBe(false)
  })

  it("recusa região diferente de gru1", () => {
    const outraRegiao = { ...(vercelJson as object), regions: ["iad1"] }
    expect(vercelConfigSchema.safeParse(outraRegiao).success).toBe(false)
  })
})

describe("next.config.ts", () => {
  it("inclui data e seed no rastreio de saída", () => {
    const includes = nextConfig.outputFileTracingIncludes?.["/**"] ?? []
    expect(includes).toContain("./seed/**/*")
    expect(includes).toContain("./data/**/*")
  })
})
