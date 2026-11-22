import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import type { Page } from "@playwright/test"
import { expectSemViolacoes } from "./apoio/a11y"
import { entrarComContaNova, entrarNaDemo, expect, test } from "./apoio/sessao"
import { TEMAS, usarTema } from "./apoio/tema"

const T = config.textosCasa
const C = config.textosConversa

const chip = (page: Page, nome: string) => page.getByRole("button", { name: nome, exact: true })
const prateleira = (page: Page, nome: string | RegExp) => page.getByRole("region", { name: nome })
const folha = (page: Page) => page.getByRole("dialog")

async function abrirCasa(page: Page): Promise<void> {
  await entrarNaDemo(page)
  await page.goto("/casa")
  await expect(page.getByRole("heading", { level: 1, name: T.titulo })).toBeVisible()
}

// Conta nova que passa pelo onboarding e chega em Minha casa, vazia.
async function abrirCasaVazia(page: Page): Promise<void> {
  await entrarComContaNova(page)
  await page.waitForURL("**/comecar/evitar")
  await page.getByRole("button", { name: "Nenhum" }).click()
  await page.waitForURL("**/comecar/dosha")
  await page.getByText("Agora não", { exact: true }).click()
  await page.getByRole("button", { name: "Pular a cidade" }).click()
  await page.getByRole("button", { name: "Continuar" }).click()
  await page.waitForURL("**/conversa")
  await page.goto("/casa")
  await expect(page.getByText(T.vazia.titulo)).toBeVisible()
}

test.describe("Ainda tem?", () => {
  test("os três incertos: dois ficam, um acabou", async ({ page }) => {
    await abrirCasa(page)
    await expect(page.getByRole("heading", { name: T.aindaTem.titulo })).toBeVisible()
    // Um toque por vez: enquanto um pedido está no ar, a tela ignora o seguinte.
    await page.getByRole("button", { name: "Ainda tenho couve" }).click()
    await expect(page.getByText(formatar(T.confirma.tenho, { Item: "Couve" }))).toBeVisible()
    await page.getByRole("button", { name: "Ainda tenho banana" }).click()
    await expect(page.getByText(formatar(T.confirma.tenho, { Item: "Banana" }))).toBeVisible()
    await page.getByRole("button", { name: "Leite acabou" }).click()
    await expect(page.getByText(formatar(T.confirma.acabou, { Item: "Leite" }))).toBeVisible()
    await expect(page.getByRole("heading", { name: T.aindaTem.titulo })).toHaveCount(0)
    await expect(prateleira(page, /Folhas/).getByRole("button", { name: "Couve" })).toBeVisible()
    await expect(prateleira(page, /Frutas/).getByRole("button", { name: "Banana" })).toBeVisible()
    await expect(
      prateleira(page, new RegExp(`^${T.prateleira.acabou}`)).getByRole("button", {
        name: "Leite",
      }),
    ).toBeVisible()
  })

  test("pôr na lista um item que acabou", async ({ page }) => {
    await abrirCasa(page)
    await page.getByRole("button", { name: "Leite acabou" }).click()
    await chip(page, "Leite").click()
    await folha(page).getByRole("button", { name: T.folha.porNaLista }).click()
    await expect(page.getByText(T.lista.pessoa)).toBeVisible()
  })
})

test.describe("folha do item", () => {
  test("sempre tenho, gosto e tirar da casa", async ({ page }) => {
    await abrirCasa(page)
    await chip(page, "Gengibre").click()
    await folha(page).getByText(T.folha.sempre, { exact: true }).click()
    await expect(page.getByText(formatar(T.confirma.sempre, { Item: "Gengibre" }))).toBeVisible()
    await folha(page).getByText(T.folha.gosto, { exact: true }).click()
    await expect(page.getByText(formatar(T.confirma.gosta, { item: "gengibre" }))).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(folha(page)).toHaveCount(0)
    await expect(chip(page, `Gengibre, ${T.rotulo.sempre}, ${T.rotulo.gosta}`)).toBeVisible()

    await chip(page, `Gengibre, ${T.rotulo.sempre}, ${T.rotulo.gosta}`).click()
    await folha(page).getByRole("button", { name: T.folha.tirar }).click()
    await expect(folha(page)).toHaveCount(0)
    await expect(page.getByRole("button", { name: /^Gengibre/ })).toHaveCount(0)
  })

  test("só com teclado: abrir, marcar e fechar com Esc", async ({ page }) => {
    await abrirCasa(page)
    await chip(page, "Gengibre").focus()
    await page.keyboard.press("Enter")
    await expect(folha(page)).toBeVisible()
    const sempre = folha(page).getByRole("switch", { name: T.folha.sempre })
    await sempre.focus()
    await page.keyboard.press("Space")
    await expect(sempre).toBeChecked()
    await expect(page.getByText(formatar(T.confirma.sempre, { Item: "Gengibre" }))).toBeVisible()
    await expect(sempre).toBeFocused()
    await page.keyboard.press("Escape")
    await expect(folha(page)).toHaveCount(0)
    await expect(chip(page, `Gengibre, ${T.rotulo.sempre}`)).toBeFocused()
  })
})

test.describe("adicionar", () => {
  test("pela busca", async ({ page }) => {
    await abrirCasa(page)
    await page.getByRole("button", { name: T.adicionar, exact: true }).click()
    await folha(page).getByRole("combobox", { name: T.adicionarBusca }).fill("cenoura")
    await page.getByRole("option", { name: /Cenoura/ }).click()
    await expect(page.getByText(formatar(T.adicionado, { Item: "Cenoura" }))).toBeVisible()
  })

  test("por texto livre", async ({ page }) => {
    await abrirCasa(page)
    await page.getByRole("button", { name: T.adicionar, exact: true }).click()
    await folha(page).getByRole("combobox", { name: T.adicionarBusca }).fill("zzqx raro")
    await page
      .getByRole("option", { name: formatar(T.adicionarLivre, { texto: "zzqx raro" }) })
      .click()
    await expect(page.getByText(formatar(T.adicionado, { Item: "Zzqx raro" }))).toBeVisible()
  })
})

test.describe("para ter em casa", () => {
  test("cardamomo aprovado na conversa vira item da lista e Comprei o põe na prateleira", async ({
    page,
  }) => {
    await entrarNaDemo(page)
    await page.getByRole("button", { name: "Enviar" }).click()
    await expect(page.getByText(C.bloco.titulo)).toBeVisible()
    await expect(page.getByRole("checkbox", { name: /Anotar:.*cardamomo/i })).toBeChecked()
    await page.getByRole("button", { name: C.bloco.anotar, exact: true }).click()
    await expect(page.getByRole("checkbox", { name: /^Anotar:/ })).toHaveCount(0)

    await page.goto("/casa")
    const lista = page.getByRole("region", { name: T.lista.titulo })
    await expect(lista.getByText("Cardamomo")).toBeVisible()
    await expect(lista.getByText(formatar(T.lista.fezFalta, { detalhe: "3" }))).toBeVisible()
    await page.getByRole("button", { name: "Comprei cardamomo" }).click()
    await expect(lista.getByText("Cardamomo")).toHaveCount(0)
    await expect(
      prateleira(page, /Especiarias/).getByRole("button", { name: "Cardamomo" }),
    ).toBeVisible()
  })
})

test("POST /api/casa com Origin de outro site é recusado", async ({ page }) => {
  await abrirCasa(page)
  const resposta = await page.request.post("/api/casa", {
    headers: { origin: "https://outro-site.example", "content-type": "application/json" },
    data: { acao: "tenho", item_id: "x" },
  })
  expect(resposta.status()).toBe(403)
})

test.describe("acessibilidade e zoom", () => {
  for (const tema of TEMAS) {
    test(`cheia, vazia e com a folha, tema ${tema}`, async ({ context, page }) => {
      await usarTema(context, tema)
      await abrirCasa(page)
      await expectSemViolacoes(page)
      await chip(page, "Gengibre").click()
      await expect(folha(page)).toBeVisible()
      // A folha entra com animação; o axe lê a cor já assentada.
      await page.waitForTimeout(500)
      await expectSemViolacoes(page)
    })

    test(`vazia, tema ${tema}`, async ({ context, page }) => {
      await usarTema(context, tema)
      await abrirCasaVazia(page)
      await expectSemViolacoes(page)
    })
  }

  test("com 200% de zoom em 1280 px não há rolagem horizontal", async ({ page }) => {
    await abrirCasa(page)
    await page.setViewportSize({ width: 640, height: 450 })
    const sobra = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(sobra).toBeLessThanOrEqual(0)
  })
})

test.describe("screenshots de Minha casa", () => {
  test.skip(!process.env.SCREENSHOTS, "defina SCREENSHOTS=1")
  const caminho = (estado: string, tema: string, projeto: string) =>
    `.plans/019-casa-${estado}-${tema}-${projeto}.png`

  for (const tema of TEMAS) {
    test(`cheia ${tema}`, async ({ context, page }, info) => {
      await usarTema(context, tema)
      await abrirCasa(page)
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: caminho("cheia", tema, info.project.name) })
    })

    test(`vazia ${tema}`, async ({ context, page }, info) => {
      await usarTema(context, tema)
      await abrirCasaVazia(page)
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: caminho("vazia", tema, info.project.name) })
    })

    test(`folha ${tema}`, async ({ context, page }, info) => {
      await usarTema(context, tema)
      await abrirCasa(page)
      await chip(page, "Gengibre").click()
      await expect(folha(page)).toBeVisible()
      await page.waitForTimeout(400)
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: caminho("folha", tema, info.project.name) })
    })
  }
})
