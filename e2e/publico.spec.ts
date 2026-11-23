import type { Page } from "@playwright/test"
import { expectSemViolacoes } from "./apoio/a11y"
import { entrarNaDemo, expect, test } from "./apoio/sessao"
import { TEMAS, usarTema } from "./apoio/tema"

const BOTAO_DEMO = "Testar com perfil de demonstração"
const BOTAO_ENTENDI = "Entendi, quero começar"

// Rola a Entrada até o fim e espera o último rodapé aparecer.
async function rolarAteOFim(page: Page): Promise<void> {
  // Desce por passos para que cada seção entre na tela e termine de aparecer.
  await page.evaluate(async () => {
    const passo = window.innerHeight * 0.8
    for (let y = 0; y < document.body.scrollHeight; y += passo) {
      window.scrollTo(0, y)
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60)))
    }
    window.scrollTo(0, document.body.scrollHeight)
  })
  await expect(page.getByRole("contentinfo")).toBeInViewport()
  await page.evaluate(() => document.fonts.ready)
  // As seções entram com um fade: o axe só mede o contraste depois que as transições terminam.
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          document
            .getAnimations()
            .filter(
              (a) =>
                a.playState === "running" &&
                Number.isFinite(a.effect?.getComputedTiming().endTime ?? 0),
            )
            .map((a) => a.id || (a as CSSAnimation).animationName || a.constructor.name)
            .join(","),
        ),
      { timeout: 5000 },
    )
    .toBe("")
}

async function semRolagemHorizontal(page: Page): Promise<void> {
  const [largura, visivel] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ])
  expect(largura).toBeLessThanOrEqual(visivel ?? 0)
}

test.describe("Entrada", () => {
  test("'Conheça o Ritu' leva o foco ao h2 'Como funciona'", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await page.getByRole("link", { name: /Conheça o Ritu/ }).click()
    await expect(page.getByRole("heading", { name: "Como funciona", level: 2 })).toBeFocused()
    await expect(page).toHaveURL(/#conheca$/)
  })

  test("a chamada final abre a demonstração até o Aviso", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    const final = page.locator("section", {
      has: page.getByRole("heading", { name: "Quer ver com os seus olhos?" }),
    })
    await final.getByRole("button", { name: BOTAO_DEMO }).click()
    await page.waitForURL("**/comecar/aviso")
    await expect(page.getByRole("button", { name: BOTAO_ENTENDI })).toBeVisible()
  })

  test("links do rodapé", async ({ page }) => {
    await page.goto("/")
    const nav = page.getByRole("contentinfo").getByRole("navigation", { name: "Links do Ritu" })
    await expect(nav.getByRole("link", { name: "Sobre e privacidade" })).toHaveAttribute(
      "href",
      "/sobre",
    )
    await expect(nav.getByRole("link", { name: "Bastidores" })).toHaveAttribute(
      "href",
      "/bastidores",
    )
    await expect(nav.getByRole("link", { name: /Código no GitHub/ })).toHaveAttribute(
      "target",
      "_blank",
    )
    await nav.getByRole("link", { name: "Sobre e privacidade" }).click()
    await page.waitForURL("**/sobre")
  })

  test("só com teclado: Tab chega ao botão da demonstração e Enter abre o Aviso", async ({
    page,
  }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    const demo = page.getByRole("button", { name: BOTAO_DEMO }).first()
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab")
      if (await demo.evaluate((el) => el === document.activeElement)) break
    }
    await expect(demo).toBeFocused()
    await page.keyboard.press("Enter")
    await page.waitForURL("**/comecar/aviso")
  })
})

test.describe("/sobre", () => {
  test("abre sem sessão e com a demonstração", async ({ page }) => {
    await page.goto("/sobre")
    await expect(page.getByRole("heading", { name: "Sobre o Ritu", level: 1 })).toBeVisible()
    await entrarNaDemo(page)
    await page.goto("/sobre")
    await expect(page.getByRole("heading", { name: "Sobre o Ritu", level: 1 })).toBeVisible()
  })

  test("#privacidade deixa o h2 visível e sem mailto: sem contato", async ({ page }) => {
    await page.goto("/sobre#privacidade")
    const titulo = page.getByRole("heading", { name: "Privacidade", level: 2 })
    await expect(titulo).toBeInViewport()
    const topo = await titulo.evaluate((el) => el.getBoundingClientRect().top)
    expect(topo).toBeGreaterThanOrEqual(0)
    await expect(page.getByRole("heading", { name: "Quem cuida dos seus dados" })).toBeVisible()
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0)
    await expect(page.getByText("use a aba Você, dentro do Ritu")).toBeVisible()
  })

  test("do Aviso até a política e de volta ao Aviso", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: BOTAO_DEMO }).first().click()
    await page.waitForURL("**/comecar/aviso")
    await page.getByRole("link", { name: "Leia a política de privacidade" }).click()
    await page.waitForURL("**/sobre#privacidade")
    await expect(page.getByRole("heading", { name: "Privacidade", level: 2 })).toBeInViewport()
    await page.goBack()
    await page.waitForURL("**/comecar/aviso")
    await expect(page.getByRole("button", { name: BOTAO_ENTENDI })).toBeVisible()
  })

  test("link em Você › Conta", async ({ page }) => {
    await entrarNaDemo(page)
    await page.goto("/voce")
    const link = page.getByRole("link", { name: "Sobre o Ritu e privacidade" })
    await expect(link).toHaveAttribute("href", "/sobre")
    await link.click()
    await page.waitForURL("**/sobre")
  })
})

test.describe("robots e sitemap", () => {
  test("robots.txt e sitemap.xml respondem", async ({ request }) => {
    const robots = await request.get("/robots.txt")
    expect(robots.status()).toBe(200)
    expect(await robots.text()).toContain("Disallow: /api/")
    const sitemap = await request.get("/sitemap.xml")
    expect(sitemap.status()).toBe(200)
  })
})

for (const tema of TEMAS) {
  test(`axe na Entrada rolada até o fim, tema ${tema}`, async ({ page, context }) => {
    await usarTema(context, tema)
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await rolarAteOFim(page)
    await expectSemViolacoes(page)
  })

  test(`axe em /sobre, tema ${tema}`, async ({ page, context }) => {
    await usarTema(context, tema)
    await page.goto("/sobre")
    await page.waitForLoadState("networkidle")
    await page.evaluate(() => document.fonts.ready)
    await expectSemViolacoes(page)
  })
}

test.describe("zoom de 200%", () => {
  test.use({ viewport: { width: 640, height: 900 }, deviceScaleFactor: 2 })

  for (const rota of ["/", "/sobre"]) {
    test(`sem rolagem horizontal em ${rota}`, async ({ page }) => {
      await page.goto(rota)
      await page.waitForLoadState("networkidle")
      if (rota === "/") await rolarAteOFim(page)
      await semRolagemHorizontal(page)
    })
  }
})
