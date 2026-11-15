import { fileURLToPath } from "node:url"
import { configDefaults, defineConfig } from "vitest/config"

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  "@config": fileURLToPath(new URL("./config", import.meta.url)),
}

export default defineConfig({
  resolve: { alias },
  test: {
    environment: "node",
    passWithNoTests: true,
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "scripts/**/*.test.ts",
      "config/**/*.test.ts",
      "test/**/*.test.ts",
    ],
    // test/db precisa de Postgres: roda só em vitest.db.config.ts.
    exclude: [...configDefaults.exclude, "e2e/**", "evals/**", "test/db/**"],
  },
})
