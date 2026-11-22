import { config } from "@config/index"
import { expect, test } from "@playwright/test"

const E = config.textosEntrada
const C = config.textosConversa

// Entrada, perfil de demonstração, Aviso, Conversa, mensagem sugerida pelo perfil e a resposta com o aviso de orientação.
test("perfil de demonstração responde com o aviso de orientação", async ({ page }) => {
  test.skip(!process.env.SITE_URL, "defina SITE_URL para o smoke completo")

  await page.goto("/")
  await page.getByRole("button", { name: E.entrada.demo }).click()
  await page.getByRole("button", { name: E.avisoInicial.botao }).click()
  await page.waitForURL("**/conversa")

  // A caixa já vem com a mensagem sugerida pelo perfil.
  const caixa = page.getByRole("textbox", { name: C.caixa.rotulo })
  await expect(caixa).not.toHaveValue("")
  await page.getByRole("button", { name: C.caixa.enviar }).click()

  // Espera o run assentar (caixa liberada) e o aviso da resposta, em até 90 s.
  await expect(caixa).not.toHaveAttribute("aria-disabled", "true", { timeout: 90_000 })
  await expect(page.getByText(C.rodape.aviso).first()).toBeVisible({ timeout: 90_000 })
})
