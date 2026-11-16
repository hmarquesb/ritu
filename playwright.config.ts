import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "e2e",
  webServer: {
    command: "npm run start",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    env: {
      RITU_MODO: "e2e",
      // Valores fixos de teste: não são segredo e só valem para o servidor do E2E.
      AUTH_SECRET: "segredo-de-teste-e2e-nao-e-segredo-0123456789",
      IP_HMAC_SECRET: "ip-hmac-de-teste-e2e-nao-e-segredo-0123456789",
      AUTH_GOOGLE_ID: "",
      AUTH_GOOGLE_SECRET: "",
    },
  },
  projects: [
    { name: "celular", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
})
