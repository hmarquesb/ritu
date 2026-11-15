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
    include: ["test/db/**/*.db.test.ts"],
    // Todos os testes de banco compartilham o schema ritu_test: um arquivo por vez.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
