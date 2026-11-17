import { expect, test } from "@playwright/test"

test("a Entrada mostra o nome e o aviso", async ({ page }) => {
  await page.goto("/")

  await expect(
    page.getByText("Ritu", { exact: true }).locator("visible=true").first(),
  ).toBeVisible()
  await expect(
    page.getByText("Projeto de estudo. Não é orientação médica.", { exact: true }),
  ).toBeVisible()
})
