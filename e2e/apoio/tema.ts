import type { BrowserContext } from "@playwright/test"

export const TEMAS = ["light", "dark"] as const

const BASE_URL = "http://localhost:3000"

// Põe o cookie ritu_theme para o servidor do teste, para a tela sair no tema pedido.
export async function usarTema(
  context: BrowserContext,
  tema: (typeof TEMAS)[number],
): Promise<void> {
  await context.addCookies([{ name: "ritu_theme", value: tema, url: BASE_URL, path: "/" }])
}
