import { textosBastidores } from "@config/index"
import type { Locator, Page } from "@playwright/test"
import { expectSemViolacoes } from "./apoio/a11y"
import { entrarNaDemo, expect, test } from "./apoio/sessao"
import { TEMAS, usarTema } from "./apoio/tema"

const T = textosBastidores

// Cenário dos números da semana: o fake do modo e2e responde pelo header do pedido.
async function abrir(page: Page, cenario: "poucos" | "ok"): Promise<void> {
  await page.setExtraHTTPHeaders({ "x-ritu-e2e-bastidores": cenario })
  await page.goto("/bastidores")
  await expect(page.getByRole("heading", { level: 1, name: T.titulo })).toBeVisible()
}

const gatilho = (page: Page): Locator => page.getByRole("button", { name: T.evals.todas })

// Enter antes da hidratação se perde: espere o React ligar os manipuladores no elemento.
async function hidratado(alvo: Locator): Promise<void> {
  await expect
    .poll(() =>
      alvo.evaluate((el) => Object.keys(el).some((chave) => chave.startsWith("__reactProps$"))),
    )
    .toBe(true)
}

test("abre sem sessão, sem redirecionar, com as três seções", async ({ page }) => {
  await abrir(page, "ok")
  await expect(page).toHaveURL(/\/bastidores$/)
  for (const titulo of [T.semana.titulo, T.evals.titulo, T.mcp.titulo]) {
    await expect(page.getByRole("heading", { level: 2, name: titulo })).toBeVisible()
  }
  await expect(page.getByText(T.aviso)).toBeVisible()
})

test("abre na demonstração, sem redirecionar", async ({ page }) => {
  await entrarNaDemo(page)
  await abrir(page, "ok")
  await expect(page).toHaveURL(/\/bastidores$/)
})

test("abaixo do piso mostra só o aviso de pouco uso", async ({ page }) => {
  await abrir(page, "poucos")
  const semana = page.getByRole("region", { name: T.semana.titulo })
  await expect(semana.getByText(T.semana.poucos.titulo)).toBeVisible()
  await expect(semana.getByText("Por enquanto são 7.")).toBeVisible()
  await expect(semana.locator("dt")).toHaveCount(0)
  await expect(page.locator("main")).not.toContainText("42")
})

test("acima do piso mostra os sete indicadores, as intenções e as tools", async ({ page }) => {
  await abrir(page, "ok")
  const semana = page.getByRole("region", { name: T.semana.titulo })
  await expect(semana.locator("dt")).toHaveCount(7)
  await expect(semana.getByText("Como estou agora")).toBeVisible()
  await expect(semana.getByText("nova_intencao")).toBeVisible()
  await expect(semana.getByText("ayurveda.candidatos")).toBeVisible()
  await expect(semana.getByText("3,4 s")).toBeVisible()
})

test("cinco gráficos, cada um com nome", async ({ page }) => {
  await abrir(page, "ok")
  const evals = page.getByRole("region", { name: T.evals.titulo })
  const graficos = evals.locator('svg[role="img"]')
  await expect(graficos).toHaveCount(5)
  for (let i = 0; i < 5; i++) {
    await expect(graficos.nth(i)).toHaveAttribute("aria-label", /.+: .+\. Meta: .+\./)
  }
})

test("Todas as métricas abre e fecha pelo teclado", async ({ page }) => {
  await abrir(page, "ok")
  const botao = gatilho(page)
  await hidratado(botao)
  await botao.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("table")).toBeVisible()
  await expect(page.getByText(T.evals.legenda)).toBeVisible()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("table")).toBeHidden()
})

test("Copiar endereço mostra o aviso", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await abrir(page, "ok")
  await expect(page.getByText("/api/mcp").first()).toBeVisible()
  const botao = page.getByRole("button", { name: T.mcp.copiar })
  await hidratado(botao)
  await botao.click()
  await expect(page.getByText(T.mcp.copiado)).toBeVisible()
})

for (const tema of TEMAS) {
  test(`axe em /bastidores, tema ${tema}, com a tabela aberta`, async ({ page, context }) => {
    await usarTema(context, tema)
    await abrir(page, "ok")
    const botao = gatilho(page)
    await hidratado(botao)
    await botao.click()
    await expect(page.getByRole("table")).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await expectSemViolacoes(page)
  })

  test(`axe em /bastidores, tema ${tema}, abaixo do piso`, async ({ page, context }) => {
    await usarTema(context, tema)
    await abrir(page, "poucos")
    await expectSemViolacoes(page)
  })
}
