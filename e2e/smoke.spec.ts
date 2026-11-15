import { expect, test } from "@playwright/test"

test("a página inicial mostra o nome e o aviso", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByText("Ritu", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Não é orientação médica.")).toBeVisible()
})
