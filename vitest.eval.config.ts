import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  "@config": fileURLToPath(new URL("./config", import.meta.url)),
}

export default defineConfig({
  resolve: { alias },
  test: {
    environment: "node",
    passWithNoTests: true,
    include: ["evals/det/**/*.eval.ts"],
  },
})
