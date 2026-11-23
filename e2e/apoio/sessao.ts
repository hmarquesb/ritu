import { randomUUID } from "node:crypto"
import { type BrowserContext, test as base, expect, type Page } from "@playwright/test"

const idsPorContexto = new WeakMap<BrowserContext, string>()

// Cada teste manda `x-ritu-e2e: <id único>` em todos os pedidos, o que isola os dados dele.
export const test = base.extend({
  context: async ({ context }, usar) => {
    const id = randomUUID()
    idsPorContexto.set(context, id)
    await context.setExtraHTTPHeaders({ "x-ritu-e2e": id })
    await usar(context)
  },
})

async function clicarNaDemo(page: Page): Promise<void> {
  await page.goto("/")
  await page.getByRole("button", { name: "Testar com perfil de demonstração" }).first().click()
  await page.getByRole("button", { name: "Entendi, quero começar" }).click()
}

export async function entrarNaDemo(page: Page): Promise<void> {
  await clicarNaDemo(page)
  await page.waitForURL("**/conversa")
}

export async function entrarComContaNova(page: Page): Promise<void> {
  const context = page.context()
  const id = idsPorContexto.get(context)
  if (!id) throw new Error("Use o `test` de e2e/apoio/sessao.ts para ter o header de isolamento.")
  await context.setExtraHTTPHeaders({ "x-ritu-e2e": id, "x-ritu-e2e-conta": "nova" })
  await clicarNaDemo(page)
  await page.waitForURL("**/comecar/aviso")
}

export { expect }
