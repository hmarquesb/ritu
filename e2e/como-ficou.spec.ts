import { config } from "@config/index"
import type { Page } from "@playwright/test"
import { expectSemViolacoes } from "./apoio/a11y"
import { entrarComContaNova, entrarNaDemo, expect, test } from "./apoio/sessao"
import { TEMAS, usarTema } from "./apoio/tema"

const T = config.textosComoFicou

const indicador = (page: Page) =>
  page.getByRole("link", { name: /sugest(ão|ões) esperando seu retorno/ })

async function abrirComoFicou(page: Page): Promise<void> {
  await entrarNaDemo(page)
  await page.goto("/como-ficou")
  await expect(page.getByRole("heading", { level: 1, name: T.titulo })).toBeVisible()
}

// Conta nova que passa pelo onboarding e chega em Como ficou?, sem retornos.
async function abrirComoFicouVazia(page: Page): Promise<void> {
  await entrarComContaNova(page)
  await page.waitForURL("**/comecar/evitar")
  await page.getByRole("button", { name: "Nenhum" }).click()
  await page.waitForURL("**/comecar/dosha")
  await page.getByText("Agora não", { exact: true }).click()
  await page.getByRole("button", { name: "Pular a cidade" }).click()
  await page.getByRole("button", { name: "Continuar" }).click()
  await page.waitForURL("**/conversa")
  await page.goto("/como-ficou")
  await expect(page.getByText(T.vazia.titulo)).toBeVisible()
}

test.describe("Como ficou?", () => {
  test("responder as duas sugestões de ontem, recarregar e voltar à conversa", async ({ page }) => {
    await abrirComoFicou(page)
    await expect(page.getByRole("heading", { level: 2, name: T.dia.ontem })).toBeVisible()
    const itens = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { level: 3 }) })
    await expect(itens).toHaveCount(2)

    await itens.nth(0).getByRole("button", { name: T.ajudou, exact: true }).click()
    await expect(itens.nth(0).getByRole("status")).toHaveText(/Anotado: ajudou\./)
    await itens.nth(1).getByRole("button", { name: T.naoFez, exact: true }).click()
    await expect(itens.nth(1).getByRole("status")).toHaveText(/Anotado: não fiz\./)

    await page.reload()
    await expect(page.getByText(T.vazia.titulo)).toBeVisible()
    await expect(page.getByRole("link", { name: T.vazia.link })).toBeVisible()

    await page.getByRole("link", { name: T.vazia.link }).click()
    await page.waitForURL("**/conversa")
    await expect(page.getByRole("textbox")).toBeVisible()
    await expect(indicador(page)).toHaveCount(0)
  })

  test("só com teclado: Enter em Ajudou anota", async ({ page }) => {
    await abrirComoFicou(page)
    const botao = page.getByRole("button", { name: T.ajudou, exact: true }).first()
    await botao.focus()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("status").first()).toHaveText(/Anotado: ajudou\./)
  })
})

test.describe("acessibilidade", () => {
  for (const tema of TEMAS) {
    test(`cheia, tema ${tema}`, async ({ context, page }) => {
      await usarTema(context, tema)
      await abrirComoFicou(page)
      await expectSemViolacoes(page)
    })

    test(`vazia, tema ${tema}`, async ({ context, page }) => {
      await usarTema(context, tema)
      await abrirComoFicouVazia(page)
      await expectSemViolacoes(page)
    })
  }
})

test.describe("screenshots de Como ficou", () => {
  test.skip(!process.env.SCREENSHOTS, "defina SCREENSHOTS=1")
  const caminho = (estado: string, tema: string, projeto: string) =>
    `.plans/019-como-ficou-${estado}-${tema}-${projeto}.png`

  for (const tema of TEMAS) {
    test(`cheia ${tema}`, async ({ context, page }, info) => {
      await usarTema(context, tema)
      await abrirComoFicou(page)
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: caminho("cheia", tema, info.project.name) })
    })

    test(`vazia ${tema}`, async ({ context, page }, info) => {
      await usarTema(context, tema)
      await abrirComoFicouVazia(page)
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: caminho("vazia", tema, info.project.name) })
    })
  }
})
