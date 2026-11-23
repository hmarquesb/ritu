import type { Page } from "@playwright/test"
import { expectSemViolacoes } from "./apoio/a11y"
import { entrarComContaNova, entrarNaDemo, expect, test } from "./apoio/sessao"
import { TEMAS, usarTema } from "./apoio/tema"

const BOTAO_DEMO = "Testar com perfil de demonstração"
const BOTAO_ENTENDI = "Entendi, quero começar"

function nonceDe(csp: string): string {
  const achado = /script-src[^;]*'nonce-([^']+)'/.exec(csp)
  if (!achado?.[1]) throw new Error("CSP sem nonce em script-src")
  return achado[1]
}

function expectHeadersDeSeguranca(headers: Record<string, string>): string {
  const csp = headers["content-security-policy"] ?? ""
  const scriptSrc = /script-src[^;]*/.exec(csp)?.[0] ?? ""
  expect(scriptSrc).not.toContain("unsafe-inline")
  expect(csp).toContain("frame-ancestors 'none'")
  expect(headers["x-content-type-options"]).toBeTruthy()
  expect(headers["referrer-policy"]).toBeTruthy()
  expect(headers["permissions-policy"]).toBeTruthy()
  return nonceDe(csp)
}

// Espera a navegação assentar antes do axe: título da página no ar e o anúncio do botão pendente já removido.
async function aguardarAssentar(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle")
  await expect(page).toHaveTitle("Ritu · agente ayurvédico para o seu momento")
  await expect(page.locator('[role="log"] [role="img"]')).toHaveCount(0)
}

function vigiarConsole(page: Page): string[] {
  const problemas: string[] = []
  page.on("console", (msg) => {
    if (/content security policy|violat/i.test(msg.text())) problemas.push(msg.text())
  })
  page.on("pageerror", (erro) => problemas.push(erro.message))
  return problemas
}

test.describe("demonstração", () => {
  test("em dois toques, só com cliques", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: BOTAO_DEMO }).first().click()
    await page.getByRole("button", { name: BOTAO_ENTENDI }).click()
    await page.waitForURL("**/conversa")
    await expect(page.getByRole("complementary", { name: "Demonstração" })).toBeVisible()
  })

  test("em dois toques, só com o teclado", async ({ page }) => {
    await page.goto("/")
    const demo = page.getByRole("button", { name: BOTAO_DEMO }).first()
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab")
      if (await demo.evaluate((el) => el === document.activeElement)) break
    }
    await expect(demo).toBeFocused()
    await page.keyboard.press("Enter")
    const entendi = page.getByRole("button", { name: BOTAO_ENTENDI })
    await expect(entendi).toBeVisible()
    for (let i = 0; i < 20; i++) {
      if (await entendi.evaluate((el) => el === document.activeElement)) break
      await page.keyboard.press("Tab")
    }
    await expect(entendi).toBeFocused()
    await page.keyboard.press("Enter")
    await page.waitForURL("**/conversa")
    await expect(page.getByRole("complementary", { name: "Demonstração" })).toBeVisible()
  })

  test("limite por IP: a 6ª demonstração volta à Entrada com o aviso", async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await entrarNaDemo(page)
      await page.context().clearCookies()
    }
    await page.goto("/")
    await page.getByRole("button", { name: BOTAO_DEMO }).first().click()
    await page.waitForURL("**/?aviso=demo_limite_ip")
    await expect(page.getByRole("status")).toContainText("5 demonstrações")
  })

  test("dados apagados: a Entrada mostra o aviso em role=status", async ({ page }) => {
    await page.goto("/?aviso=dados_apagados")
    await expect(page.getByRole("status")).toContainText("Seus dados foram apagados.")
  })

  test("sem Google, o botão não aparece", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("button", { name: BOTAO_DEMO }).first()).toBeVisible()
    await expect(page.getByRole("button", { name: /Entrar com Google/ })).toHaveCount(0)
  })

  test("Sair no menu da conta volta à Entrada", async ({ page }) => {
    await entrarNaDemo(page)
    await page.getByRole("button", { name: "Menu da conta" }).click()
    await page.getByRole("menuitem", { name: "Sair" }).click()
    await page.waitForURL((url) => url.pathname === "/")
    await expect(page.getByRole("button", { name: BOTAO_DEMO }).first()).toBeVisible()
  })
})

test.describe("headers e origem", () => {
  test("headers de segurança e nonce por pedido", async ({ page }) => {
    await entrarNaDemo(page)
    for (const rota of ["/", "/marca", "/conversa", "/api/alimentos?q=ab"]) {
      const a = await page.request.get(rota, { maxRedirects: 0 })
      const b = await page.request.get(rota, { maxRedirects: 0 })
      const nonceA = expectHeadersDeSeguranca(a.headers())
      const nonceB = expectHeadersDeSeguranca(b.headers())
      expect(nonceA, rota).not.toBe(nonceB)
    }
  })

  test("POST com Origin de fora é recusado", async ({ page }) => {
    await entrarComContaNova(page)
    const resposta = await page.request.post("/api/onboarding/aviso", {
      headers: { Origin: "https://outro.exemplo" },
      data: {},
    })
    expect(resposta.status()).toBe(403)
  })

  test("nenhuma violação de CSP no console", async ({ page }) => {
    const problemas = vigiarConsole(page)
    await page.goto("/")
    await page.goto("/marca")
    await entrarComContaNova(page)
    await expect(page).toHaveURL(/\/comecar\/aviso/)
    await page.goto("/comecar/aviso")
    await page.waitForLoadState("networkidle")
    // Conta nova sem o onboarding pronto: /conversa redireciona para o passo pendente de /comecar.
    await page.goto("/conversa", { waitUntil: "networkidle" })
    await expect(page).toHaveURL(/\/comecar\//)
    expect(problemas).toEqual([])
  })

  test("nenhuma violação de CSP em /conversa logado", async ({ page }) => {
    const problemas = vigiarConsole(page)
    await entrarNaDemo(page)
    await page.waitForLoadState("networkidle")
    expect(problemas).toEqual([])
  })
})

for (const tema of TEMAS) {
  test.describe(`axe no tema ${tema}`, () => {
    test("Entrada", async ({ context, page }) => {
      await usarTema(context, tema)
      await page.goto("/")
      await expectSemViolacoes(page)
    })

    test("Entrada com aviso de dados apagados", async ({ context, page }) => {
      await usarTema(context, tema)
      await page.goto("/?aviso=dados_apagados")
      await expect(page.getByRole("status")).toContainText("Seus dados foram apagados.")
      await expectSemViolacoes(page)
    })

    test("Aviso", async ({ context, page }) => {
      await usarTema(context, tema)
      await entrarComContaNova(page)
      await aguardarAssentar(page)
      await expectSemViolacoes(page)
    })

    test("Conversa", async ({ context, page }) => {
      await usarTema(context, tema)
      await entrarNaDemo(page)
      await aguardarAssentar(page)
      await expectSemViolacoes(page)
    })
  })
}

test.describe("screenshots da Entrada", () => {
  for (const tema of TEMAS) {
    test(`entrada ${tema}`, async ({ context, page }, info) => {
      await usarTema(context, tema)
      await page.goto("/")
      await expect(page.getByRole("button", { name: BOTAO_DEMO }).first()).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: `.plans/017-entrada-${tema}-${info.project.name}.png` })
    })
  }
})
