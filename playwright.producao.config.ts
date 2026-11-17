import { defineConfig, devices } from "@playwright/test"

// Smoke completo da produção: roda contra o site no ar (SITE_URL), sem servidor local e sem retry.
export default defineConfig({
  testDir: "e2e-producao",
  use: { baseURL: process.env.SITE_URL },
  retries: 0,
  timeout: 120_000,
  projects: [{ name: "celular", use: { ...devices["Pixel 7"] } }],
})
