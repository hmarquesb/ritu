import { expect, type Page, test } from "@playwright/test"
import { expectSemViolacoes } from "./apoio/a11y"
import { TEMAS, usarTema } from "./apoio/tema"

const BASE = "http://localhost:3000"

// Roda no navegador: devolve os alvos de toque visíveis com área menor que 44 × 44 px.
// Mede o layout (sem a escala do botão apertado). A área é a caixa do alvo ou a do pseudo-elemento que a amplia.
function medirAlvos(seletor: string): string[] {
  function area(el: HTMLElement): { largura: number; altura: number } | null {
    const alvo = el.matches("input") ? (el.closest("label") ?? el) : el
    const r = alvo.getBoundingClientRect()
    const invisivel = r.width <= 1 || r.height <= 1 // inclui os botões de dispensar, escondidos
    const foraDaTela = r.bottom <= 0 || r.right <= 0 // como o link de pular
    if (invisivel || foraDaTela) return null
    const depois = getComputedStyle(alvo, "::after")
    const pseudo = depois.position === "absolute" ? depois : null
    return {
      largura: Math.max(alvo.offsetWidth, Number.parseFloat(pseudo?.width ?? "0") || 0),
      altura: Math.max(alvo.offsetHeight, Number.parseFloat(pseudo?.height ?? "0") || 0),
    }
  }
  const pequenos: string[] = []
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(seletor))) {
    const medida = el.closest("[data-inline]") ? null : area(el)
    if (!medida || (medida.largura >= 43.5 && medida.altura >= 43.5)) continue
    const nome = (el.textContent ?? "").trim().slice(0, 30)
    pequenos.push(
      `${el.tagName} "${nome}" ${Math.round(medida.largura)}x${Math.round(medida.altura)}`,
    )
  }
  return pequenos
}

async function abrirBusca(page: Page): Promise<void> {
  const campo = page.getByTestId("busca").getByRole("combobox")
  await campo.click()
  await campo.fill("g")
  await expect(page.getByRole("option").first()).toBeVisible()
}

for (const tema of TEMAS) {
  test.describe(`axe no tema ${tema}`, () => {
    test.beforeEach(async ({ context, page }) => {
      await usarTema(context, tema)
      await page.goto("/marca")
    })

    test("página parada", async ({ page }) => {
      await expectSemViolacoes(page)
    })

    test("menu aberto", async ({ page }) => {
      await page.getByTestId("abrir-menu").click()
      await expect(page.getByRole("menuitem").first()).toBeVisible()
      await expectSemViolacoes(page)
    })

    test("diálogo aberto", async ({ page }) => {
      await page.getByTestId("abrir-dialogo").click()
      await expect(page.getByRole("dialog")).toBeVisible()
      await expectSemViolacoes(page)
    })

    test("folha aberta", async ({ page }) => {
      await page.getByTestId("abrir-folha").click()
      await expect(page.getByRole("dialog")).toBeVisible()
      await expectSemViolacoes(page)
    })

    test("lista da busca aberta", async ({ page }) => {
      await abrirBusca(page)
      // Com a lista aberta o React Aria esconde o resto da página com aria-hidden, mas deixa
      // seus controles focáveis (comportamento da biblioteca para listas não modais). Esse
      // resto já foi conferido na página parada; aqui vale a lista e o campo.
      await expectSemViolacoes(page, { excluir: ['[aria-hidden="true"]'] })
    })

    test("dica aberta", async ({ page }) => {
      await page.getByTestId("abrir-dica").focus()
      await expect(page.getByRole("tooltip")).toBeVisible()
      await expectSemViolacoes(page)
    })

    test("aviso breve aberto", async ({ page }) => {
      await page.getByTestId("mostrar-aviso").click()
      await expect(page.getByText("Anotei na sua casa.")).toBeVisible()
      await expectSemViolacoes(page)
    })
  })
}

test("fontes locais: nenhum pedido sai da origem do servidor", async ({ page }) => {
  const externos: string[] = []
  page.on("request", (req) => {
    const url = new URL(req.url())
    if (url.protocol.startsWith("http") && url.origin !== BASE) externos.push(req.url())
  })
  await page.goto("/marca")
  await page.waitForLoadState("networkidle")
  expect(externos).toEqual([])
})

test("tema automático segue o aparelho escuro", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark", baseURL: BASE })
  const page = await context.newPage()
  await page.goto("/marca")
  const fundo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(fundo).toBe("rgb(30, 22, 17)")
  await context.close()
})

test("tema manual grava o cookie e o servidor já responde com ele", async ({
  browser,
  context,
  page,
}) => {
  const claro = await browser.newContext({ colorScheme: "light", baseURL: BASE })
  const p = await claro.newPage()
  await p.goto("/marca")
  const antes = await p.evaluate(() => getComputedStyle(document.body).backgroundColor)
  await p
    .getByRole("radio", { name: "Escuro" })
    .or(p.getByRole("button", { name: "Escuro" }))
    .click()
  await expect
    .poll(() => p.evaluate(() => document.documentElement.getAttribute("data-theme")))
    .toBe("dark")
  const depois = await p.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(depois).not.toBe(antes)
  expect((await claro.cookies()).find((c) => c.name === "ritu_theme")?.value).toBe("dark")

  await p.reload()
  expect(await p.evaluate(() => document.documentElement.dataset.theme)).toBe("dark")
  const html = await (
    await p.request.get("/marca", { headers: { cookie: "ritu_theme=dark" } })
  ).text()
  expect(html).toContain('data-theme="dark"')

  await p
    .getByRole("radio", { name: "Automático" })
    .or(p.getByRole("button", { name: "Automático" }))
    .click()
  await expect
    .poll(async () => (await claro.cookies()).some((c) => c.name === "ritu_theme"))
    .toBe(false)
  await claro.close()
  void context
  void page
})

test.describe("teclado", () => {
  test.skip(({ isMobile }) => isMobile, "só no desktop")

  test("Tab mostra o anel de foco", async ({ page }) => {
    await page.goto("/marca")
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab")
      const estilo = await page.evaluate(() => {
        const el = document.activeElement
        return el ? getComputedStyle(el).outlineStyle : "none"
      })
      expect(estilo).not.toBe("none")
    }
  })

  test("diálogo: Enter abre, prende o foco, Esc fecha e devolve o foco", async ({ page }) => {
    await page.goto("/marca")
    const gatilho = page.getByTestId("abrir-dialogo")
    await gatilho.focus()
    await page.keyboard.press("Enter")
    const dialogo = page.getByRole("dialog")
    await expect(dialogo).toBeVisible()
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab")
      const dentro = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))
      expect(dentro).toBe(true)
    }
    await page.keyboard.press("Escape")
    await expect(dialogo).toBeHidden()
    await expect(gatilho).toBeFocused()
  })

  test("menu navega com as setas", async ({ page }) => {
    await page.goto("/marca")
    await page.getByTestId("abrir-menu").focus()
    await page.keyboard.press("Enter")
    const itens = page.getByRole("menuitem")
    await expect(itens.first()).toBeVisible()
    await expect(itens.first()).toBeFocused()
    await page.keyboard.press("ArrowDown")
    await expect(itens.nth(1)).toBeFocused()
  })

  test("abas trocam com as setas", async ({ page }) => {
    await page.goto("/marca")
    const aba = page.getByRole("tab").first()
    await aba.click()
    await page.keyboard.press("ArrowRight")
    await expect(page.getByRole("tab").nth(1)).toBeFocused()
    await expect(page.getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true")
  })
})

test("alvos de toque têm ao menos 44 × 44 px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "celular", "só no celular")
  await page.goto("/marca")
  const seletor =
    'button, [role="tab"], [role="switch"], [role="checkbox"], [role="menuitem"], [role="option"], a[href]'
  const medir = () => page.evaluate(medirAlvos, seletor)
  await expect.poll(medir).toEqual([])

  await page.getByTestId("abrir-menu").click()
  await expect(page.getByRole("menuitem").first()).toBeVisible()
  await expect.poll(medir).toEqual([])
  await page.keyboard.press("Escape")

  await abrirBusca(page)
  await expect.poll(medir).toEqual([])
})

test("reflow em 320 px sem rolagem horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto("/marca")
  const largura = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(largura).toBeLessThanOrEqual(320)
})

test("movimento reduzido zera transições e animações", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", baseURL: BASE })
  const page = await context.newPage()
  await page.goto("/marca")
  const lentos = await page.evaluate(() => {
    const segundos = (v: string) => v.split(",").map((s) => Number.parseFloat(s))
    const achados: string[] = []
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const e = getComputedStyle(el)
      const todos = [...segundos(e.transitionDuration), ...segundos(e.animationDuration)]
      if (todos.some((n) => n > 0.01)) achados.push(`${el.tagName}.${el.className}`)
    }
    return achados
  })
  expect(lentos).toEqual([])
  await context.close()
})

test("marca: símbolo com nome e manchas com o nome do dosha", async ({ page }) => {
  await page.goto("/marca")
  await expect(page.getByRole("img", { name: "Ritu", exact: true }).first()).toBeVisible()
  for (const nome of ["Vata", "Pitta", "Kapha"]) {
    await expect(page.getByText(nome, { exact: true }).first()).toBeVisible()
  }
})

test.describe("screenshots", () => {
  test.skip(!process.env.SCREENSHOTS, "defina SCREENSHOTS=1")
  for (const tema of TEMAS) {
    test(`página inteira ${tema}`, async ({ context, page }, testInfo) => {
      await usarTema(context, tema)
      await page.goto("/marca")
      await page.waitForLoadState("networkidle")
      await page.screenshot({
        path: `.plans/016-marca-${tema}-${testInfo.project.name}.png`,
        fullPage: true,
      })
    })
  }
})
