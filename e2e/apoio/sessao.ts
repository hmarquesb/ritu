import { randomUUID } from "node:crypto"
import { type BrowserContext, test as base, expect, type Page } from "@playwright/test"

const idsPorContexto = new WeakMap<BrowserContext, string>()
const extrasPorContexto = new WeakMap<BrowserContext, Record<string, string>>()

async function mandarCabecalhos(
  context: BrowserContext,
  id: string,
  extras: Record<string, string>,
): Promise<void> {
  extrasPorContexto.set(context, extras)
  await context.setExtraHTTPHeaders({ "x-ritu-e2e": id, ...extras })
}

// 21h em São Paulo do dia corrente (00:00Z do dia seguinte): a couve entra nos candidatos da pergunta de casa.
export function noiteDeSaoPaulo(hoje = new Date()): string {
  const [ano, mes, dia] = hoje
    .toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
    .split("-")
  return new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia) + 1)).toISOString()
}

// Fixa o relógio do servidor (header `x-ritu-e2e-agora`) à noite, para os testes que dependem da pergunta de casa.
export async function fixarNoite(context: BrowserContext): Promise<void> {
  const id = idsPorContexto.get(context)
  if (!id) throw new Error("Use o `test` de e2e/apoio/sessao.ts para ter o header de isolamento.")
  await mandarCabecalhos(context, id, {
    ...extrasPorContexto.get(context),
    "x-ritu-e2e-agora": noiteDeSaoPaulo(),
  })
}

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
  await page.getByRole("button", { name: "Testar com perfil de demonstração" }).click()
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
  await mandarCabecalhos(context, id, {
    ...extrasPorContexto.get(context),
    "x-ritu-e2e-conta": "nova",
  })
  await clicarNaDemo(page)
  await page.waitForURL("**/comecar/aviso")
}

export { expect }
