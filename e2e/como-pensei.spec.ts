import { config } from "@config/index"
import type { Page } from "@playwright/test"
import { expectSemViolacoes } from "./apoio/a11y"
import { entrarNaDemo, expect, test } from "./apoio/sessao"
import { TEMAS, usarTema } from "./apoio/tema"

const T = config.textosComoPensei
const C = config.textosConversa

const UUID_INEXISTENTE = "5b0f3a3e-7c1d-4a52-9d0e-3f6b8a1c2d4e"

const ORDEM_DOS_PASSOS = [
  /^Entendi que você falou de/,
  /^Vi o clima/,
  /^Olhei sua casa/,
  /^Conferi a resposta/,
  /^Revisei a resposta com cuidado/,
  /^Você aprovou/,
  /^Entreguei a resposta/,
]

// Envia a mensagem sugerida pelo perfil e abre "Como pensei" pelo link da resposta.
async function abrirComoPensei(page: Page): Promise<void> {
  await entrarNaDemo(page)
  await expect(page.getByRole("textbox")).not.toHaveValue("")
  await page.getByRole("button", { name: "Enviar" }).click()
  await expect(page.getByText(C.bloco.titulo)).toBeVisible({ timeout: 30_000 })
  // Com o bloco aprovado o run termina e a linha do tempo ganha o desfecho.
  await page.getByRole("button", { name: C.bloco.anotar, exact: true }).click()
  await expect(page.getByRole("checkbox", { name: /^Anotar:/ })).toHaveCount(0)
  await page.getByRole("link", { name: C.etapas.comoPensei }).click()
  await page.waitForURL("**/como-pensei/**")
  await expect(page.getByRole("heading", { level: 1, name: T.titulo })).toBeVisible()
}

async function abrirDetalhes(page: Page): Promise<void> {
  for (const resumo of await page.locator("details > summary").all()) {
    await resumo.click()
  }
}

test.describe("Como pensei", () => {
  test("cabeçalho, passos na ordem e detalhes do run", async ({ page }) => {
    await abrirComoPensei(page)
    await expect(page.getByText(/^Mensagem de .+, \d{1,2}:\d{2}$/)).toBeVisible()
    await expect(page.getByRole("link", { name: T.voltar })).toBeVisible()

    const passos = page.locator("ol")
    const itens = passos.getByRole("listitem")
    const textos = await itens.evaluateAll((els) =>
      els.map((el) => (el.querySelector("p")?.textContent ?? el.textContent ?? "").trim()),
    )
    let ultimo = -1
    for (const padrao of ORDEM_DOS_PASSOS) {
      const i = textos.findIndex((t, pos) => pos > ultimo && padrao.test(t))
      expect(i, `passo ${padrao}`).toBeGreaterThan(ultimo)
      ultimo = i
    }

    const detalhesDoRun = page.locator("details", { hasText: T.detalhesDoRun })
    await expect(detalhesDoRun).not.toHaveAttribute("open", "")
    await detalhesDoRun.getByText(T.detalhesDoRun, { exact: true }).click()
    await expect(detalhesDoRun).toHaveAttribute("open", "")
    await expect(detalhesDoRun.getByText(T.tecnico.passos, { exact: true })).toBeVisible()
    await expect(detalhesDoRun.getByText(T.tecnico.tempoTotal)).toBeVisible()

    await page.getByRole("link", { name: T.voltar }).click()
    await page.waitForURL("**/conversa")
  })

  test("run inexistente ou de outra conta é 404", async ({ page }) => {
    await entrarNaDemo(page)
    // O status já saiu com a casca da página (loading.tsx); o que prova o 404 é a página de não encontrado.
    const naoEncontrada = page.getByText("This page could not be found.")
    await page.goto(`/como-pensei/${UUID_INEXISTENTE}`)
    await expect(naoEncontrada).toBeVisible()
    await expect(page.getByRole("heading", { level: 1, name: T.titulo })).toHaveCount(0)
    await page.goto("/como-pensei/nao-e-um-id")
    await expect(naoEncontrada).toBeVisible()
  })

  test("só com teclado: o link e os detalhes abrem com Enter", async ({ page }) => {
    await abrirComoPensei(page)
    const resumo = page.locator("summary", { hasText: T.detalhesDoRun })
    await resumo.focus()
    await expect(resumo).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(page.locator("details", { hasText: T.detalhesDoRun })).toHaveAttribute("open", "")
  })

  for (const tema of TEMAS) {
    test(`acessibilidade, tema ${tema}`, async ({ context, page }) => {
      await usarTema(context, tema)
      await abrirComoPensei(page)
      await expectSemViolacoes(page)
      await abrirDetalhes(page)
      await expectSemViolacoes(page)
    })
  }
})

test.describe("screenshots de Como pensei", () => {
  test.skip(!process.env.SCREENSHOTS, "defina SCREENSHOTS=1")
  const caminho = (estado: string, tema: string, projeto: string) =>
    `.plans/020-como-pensei-${estado}-${tema}-${projeto}.png`

  for (const tema of TEMAS) {
    test(`fechado e aberto ${tema}`, async ({ context, page }, info) => {
      await usarTema(context, tema)
      await abrirComoPensei(page)
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: caminho("fechado", tema, info.project.name), fullPage: true })
      await abrirDetalhes(page)
      await page.screenshot({ path: caminho("aberto", tema, info.project.name), fullPage: true })
    })
  }
})
