import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import type { Locator, Page } from "@playwright/test"
import { expectSemViolacoes } from "./apoio/a11y"
import { entrarComContaNova, entrarNaDemo, expect, test } from "./apoio/sessao"
import { TEMAS, usarTema } from "./apoio/tema"

const T = config.textosVoce
const C = config.textosConversa

const RESPOSTAS_DUAL = ["vata", "vata", "vata", "vata", "pitta", "pitta", "pitta", "kapha"]

const botao = (page: Page | Locator, nome: string | RegExp, exact = false) =>
  page.getByRole("button", { name: nome, exact })
const nivel = (page: Page, titulo: string) => page.getByRole("region", { name: titulo })
const dialogo = (page: Page) => page.getByRole("dialog")
const confirmacao = (page: Page) => page.locator('section[role="alertdialog"]')

async function abrirVoce(page: Page): Promise<void> {
  await entrarNaDemo(page)
  await page.goto("/voce")
  await expect(page.getByRole("heading", { level: 1, name: T.titulo })).toBeVisible()
}

// Conta nova que passa pelo onboarding sem dosha nem cidade e chega em Você, sem nada guardado.
async function abrirVoceSemDosha(page: Page): Promise<void> {
  await entrarComContaNova(page)
  await page.waitForURL("**/comecar/evitar")
  await botao(page, "Nenhum").click()
  await page.waitForURL("**/comecar/dosha")
  await page.getByText("Agora não", { exact: true }).click()
  await botao(page, "Pular a cidade").click()
  await botao(page, "Continuar").click()
  await page.waitForURL("**/conversa")
  await page.goto("/voce")
  await expect(page.getByRole("heading", { level: 3, name: T.semDosha.titulo })).toBeVisible()
}

// A folha entra com animação; o axe e a foto leem a cor já assentada.
async function assentar(page: Page): Promise<void> {
  await page.waitForTimeout(500)
  await semAnuncioPendente(page)
  await page.evaluate(() => document.fonts.ready)
}

// O anúncio do botão pendente entra no DOM uns 100 ms depois do toque; espere ele chegar e sair.
async function semAnuncioPendente(page: Page): Promise<void> {
  await page.waitForTimeout(300)
  await expect(page.locator('[role="log"] [role="img"]')).toHaveCount(0)
}

async function responderQuiz(page: Page): Promise<void> {
  for (const [i, dosha] of RESPOSTAS_DUAL.entries()) {
    await expect(page.getByText(`Pergunta ${i + 1} de 8`)).toBeVisible()
    await page
      .locator("label")
      .filter({ has: page.locator(`input[value="${dosha}"]`) })
      .click()
    const ultima = i === RESPOSTAS_DUAL.length - 1
    await botao(page, ultima ? "Ver resultado" : "Próxima").click()
  }
  await expect(page.getByRole("heading", { level: 1, name: /Seu dosha é/ })).toBeVisible()
  await semAnuncioPendente(page)
}

async function sheetDeEvitar(page: Page): Promise<Locator> {
  await botao(page, T.fixos.adicionar).nth(0).click()
  return dialogo(page)
}

test.describe("a carta e os níveis", () => {
  test("carta do seed com a proporção e as abas; os sete níveis preenchidos", async ({ page }) => {
    await abrirVoce(page)
    await expect(page.getByText("Vata-Pitta", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("45% Vata · 45% Pitta · 10% Kapha")).toBeVisible()
    await expect(page.getByRole("tab", { name: "Vata" })).toBeVisible()
    await page.getByRole("tab", { name: "Pitta" }).click()
    await expect(page.getByRole("tab", { name: "Pitta" })).toHaveAttribute("aria-selected", "true")

    for (const n of Object.values(T.nivel)) {
      await expect(page.getByRole("heading", { level: 3, name: n.titulo })).toBeVisible()
    }
    await expect(
      nivel(page, T.nivel.gostos.titulo).getByText("Canela", { exact: true }),
    ).toBeVisible()
    await expect(nivel(page, T.nivel.faltas.titulo).getByText("Cardamomo")).toBeVisible()
    await expect(
      nivel(page, T.nivel.rotina.titulo).getByText("Almoça fora durante a semana", { exact: true }),
    ).toBeVisible()
    await expect(page.getByText(/12 itens/)).toBeVisible()
    await expect(page.getByRole("link", { name: T.casa.link })).toBeVisible()
  })

  test("restrição vegetariana ligada", async ({ page }) => {
    await abrirVoce(page)
    const chip = botao(page, T.fixos.restricao.vegetariana, true)
    await expect(chip).toHaveAttribute("aria-pressed", "false")
    await chip.click()
    await expect(chip).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByText("Anotei: vegetariana.")).toBeVisible()
    await page.reload()
    await expect(botao(page, T.fixos.restricao.vegetariana, true)).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })
})

test.describe("evitar sempre", () => {
  test("acrescentar um grupo, tirar com 'Manter' e com 'Tirar'", async ({ page }) => {
    await abrirVoce(page)
    const fixos = nivel(page, T.nivel.fixos.titulo)
    const folha = await sheetDeEvitar(page)
    await folha.getByRole("group", { name: "Grupos de alimentos" }).getByText("Ovo").click()
    await folha.getByRole("button", { name: T.dosha.salvar, exact: true }).click()
    await expect(dialogo(page)).toHaveCount(0)
    await expect(fixos.getByRole("button", { name: "Tirar Ovo" })).toBeVisible()

    await fixos.getByRole("button", { name: "Tirar Ovo" }).click()
    await expect(confirmacao(page)).toBeVisible()
    await expect(
      confirmacao(page).getByRole("heading", {
        name: formatar(T.evitar.confirmaTitulo, { item: "Ovo" }),
      }),
    ).toBeVisible()
    await confirmacao(page).getByRole("button", { name: T.evitar.manter, exact: true }).click()
    await expect(confirmacao(page)).toHaveCount(0)
    await expect(fixos.getByRole("button", { name: "Tirar Ovo" })).toBeVisible()

    await fixos.getByRole("button", { name: "Tirar Ovo" }).click()
    await confirmacao(page).getByRole("button", { name: T.evitar.tirar, exact: true }).click()
    await expect(confirmacao(page)).toHaveCount(0)
    await expect(fixos.getByRole("button", { name: "Tirar Ovo" })).toHaveCount(0)
    await expect(fixos.getByRole("button", { name: "Tirar Castanhas" })).toBeVisible()
  })

  test("Esc na confirmação não tira nada", async ({ page }) => {
    await abrirVoce(page)
    await botao(page, "Tirar Castanhas").click()
    await expect(confirmacao(page)).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(confirmacao(page)).toHaveCount(0)
    await expect(botao(page, "Tirar Castanhas")).toBeVisible()
  })

  test("não como por texto livre", async ({ page }) => {
    await abrirVoce(page)
    await botao(page, T.fixos.adicionar).nth(1).click()
    const folha = dialogo(page)
    await folha.getByRole("textbox", { name: "Outro alimento" }).fill("Zzqx raro")
    await folha.getByRole("button", { name: "Adicionar", exact: true }).click()
    await expect(dialogo(page)).toHaveCount(0)
    await expect(botao(page, "Tirar Zzqx raro")).toBeVisible()
  })
})

test.describe("o que sei sobre você", () => {
  test("corrigir e apagar uma nota de rotina", async ({ page }) => {
    await abrirVoce(page)
    const rotina = nivel(page, T.nivel.rotina.titulo)
    await botao(page, "Corrigir nota: Almoça fora durante a semana").click()
    const campo = dialogo(page).getByRole("textbox", { name: T.rotina.campo })
    await campo.fill("Almoça em casa")
    await dialogo(page).getByRole("button", { name: T.rotina.salvar, exact: true }).click()
    await expect(dialogo(page)).toHaveCount(0)
    await expect(rotina.getByText("Almoça em casa", { exact: true })).toBeVisible()
    await expect(rotina.getByText("Almoça fora durante a semana", { exact: true })).toHaveCount(0)

    await botao(page, "Apagar nota: Almoça em casa").click()
    await expect(rotina.getByText("Almoça em casa", { exact: true })).toHaveCount(0)
    await expect(rotina.getByText("Janta tarde, depois das 21 h", { exact: true })).toBeVisible()
  })

  test("confirmar o padrão do seed", async ({ page }) => {
    await abrirVoce(page)
    const padroes = nivel(page, T.nivel.padroes.titulo)
    await botao(page, /^Está certo:/).click()
    await expect(botao(page, /^Apagar padrão:/)).toBeVisible()
    await expect(padroes.getByText(/confirmado em/)).toBeVisible()
    await expect(botao(page, /^Está certo:/)).toHaveCount(0)
  })

  test("esquecer um gosto", async ({ page }) => {
    await abrirVoce(page)
    const gostos = nivel(page, T.nivel.gostos.titulo)
    await expect(gostos.getByText("Quiabo")).toBeVisible()
    await botao(page, "Esquecer: Quiabo").click()
    await expect(gostos.getByText("Quiabo")).toHaveCount(0)
    await expect(gostos.getByText("Canela", { exact: true })).toBeVisible()
  })

  test("apagar a falta de cardamomo", async ({ page }) => {
    await abrirVoce(page)
    const faltas = nivel(page, T.nivel.faltas.titulo)
    await expect(faltas.getByText("Cardamomo")).toBeVisible()
    await botao(page, "Apagar: Cardamomo").click()
    await expect(faltas.getByText("Cardamomo")).toHaveCount(0)
    await expect(faltas.getByText(T.nivel.faltas.vazio)).toBeVisible()
  })

  test("apagar a conversa de hoje e ver a Conversa vazia", async ({ page }) => {
    await entrarNaDemo(page)
    await botao(page, "Enviar").click()
    await expect(page.getByText(C.bloco.titulo)).toBeVisible()
    // Com a proposta ainda esperando a pessoa, o run está aberto: a conversa de hoje não se apaga.
    await page.goto("/voce")
    const conversa = nivel(page, T.nivel.conversa.titulo)
    await expect(conversa.getByText(/^Hoje · \d+ mensagens/)).toBeVisible()
    await botao(page, "Apagar: hoje").click()
    await confirmacao(page).getByRole("button", { name: T.apagar, exact: true }).click()
    await expect(page.getByText(T.conversa.emAndamento)).toBeVisible()
    await confirmacao(page).getByRole("button", { name: T.manter, exact: true }).click()

    await page.goto("/conversa")
    await botao(page, C.bloco.anotar, true).click()
    await expect(page.getByRole("checkbox", { name: /^Anotar:/ })).toHaveCount(0)
    await page.goto("/voce")
    await botao(page, "Apagar: hoje").click()
    await confirmacao(page).getByRole("button", { name: T.apagar, exact: true }).click()
    await expect(conversa.getByText(/^Hoje/)).toHaveCount(0)
    await page.goto("/conversa")
    await expect(page.getByText(C.bloco.titulo)).toHaveCount(0)
    await expect(page.getByText(C.vazia.titulo)).toBeVisible()
  })

  test("trocar a cidade pela busca e depois tirá-la", async ({ page }) => {
    await abrirVoce(page)
    const fixos = nivel(page, T.nivel.fixos.titulo)
    await expect(fixos.getByText("Rio de Janeiro")).toBeVisible()
    await botao(fixos, T.fixos.mudar).nth(1).click()
    await expect(dialogo(page)).toBeVisible()
    const campo = dialogo(page).getByRole("combobox", { name: "Buscar cidade" })
    await campo.pressSequentially("são")
    const opcao = page.getByRole("option", { name: /São Paulo/ })
    // Pelo teclado: a lista fica invisível enquanto o React Aria a posiciona e o ponteiro não a acerta.
    await expect(opcao).toHaveCount(1)
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("Enter")
    await expect(campo).toHaveValue(/São Paulo/)
    await dialogo(page).getByRole("button", { name: T.dosha.salvar, exact: true }).click()
    await expect(dialogo(page)).toHaveCount(0)
    await expect(page.getByText(/^Cidade: São Paulo/)).toBeVisible()
    await expect(fixos.getByText(/São Paulo/)).toBeVisible()
    await expect(fixos.getByText("Rio de Janeiro")).toHaveCount(0)

    await botao(fixos, T.fixos.mudar).nth(1).click()
    await dialogo(page).getByRole("button", { name: T.fixos.tirarCidade }).click()
    await expect(dialogo(page)).toHaveCount(0)
    await expect(page.getByText(T.fixos.semCidade)).toBeVisible()
  })

  test("já sei meu dosha: Misto com dois", async ({ page }) => {
    await abrirVoceSemDosha(page)
    await botao(page, T.semDosha.jaSei).click()
    await dialogo(page).getByText(T.dosha.misto, { exact: true }).click()
    const dois = dialogo(page).getByRole("group", { name: T.dosha.mistoAjuda })
    await dois.getByText("Vata", { exact: true }).click()
    await dois.getByText("Kapha", { exact: true }).click()
    await dialogo(page).getByRole("button", { name: T.dosha.salvar, exact: true }).click()
    await expect(dialogo(page)).toHaveCount(0)
    await expect(page.getByText("Vata-Kapha").first()).toBeVisible()
    await expect(page.getByText(T.dosha.escolhido, { exact: true })).toBeVisible()
  })
})

test.describe("refazer o quiz", () => {
  test("até o resultado e de volta a Você", async ({ page }) => {
    await abrirVoce(page)
    await page.getByRole("link", { name: T.dosha.refazer }).click()
    await page.waitForURL("**/voce/quiz")
    await responderQuiz(page)
    await botao(page, T.quiz.voltar).click()
    await page.waitForURL("**/voce")
    await expect(page.getByText("Vata-Pitta", { exact: true }).first()).toBeVisible()
  })
})

test.describe("tema, conta e segurança", () => {
  test("tema escuro pelo ThemeSwitcher", async ({ page }) => {
    await abrirVoce(page)
    await page.getByRole("radio", { name: "Escuro", exact: true }).click()
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
    await page.reload()
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
  })

  test("Apagar meus dados leva à Entrada com o aviso", async ({ page }) => {
    await abrirVoce(page)
    await botao(page, T.conta.apagar, true).click()
    await expect(confirmacao(page)).toBeVisible()
    await confirmacao(page).getByRole("button", { name: T.conta.apagarTudo, exact: true }).click()
    await page.waitForURL(/\/\?aviso=dados_apagados/)
    await expect(page.getByText(config.textosEntrada.aviso.dados_apagados)).toBeVisible()
  })

  test("POST /api/perfil com Origin de outro site é recusado", async ({ page }) => {
    await abrirVoce(page)
    const resposta = await page.request.post("/api/perfil", {
      headers: { origin: "https://outro-site.example", "content-type": "application/json" },
      data: { acao: "restricoes", restricoes: [] },
    })
    expect(resposta.status()).toBe(403)
  })

  test("só com teclado: Espaço liga uma restrição", async ({ page }) => {
    await abrirVoce(page)
    const chip = botao(page, T.fixos.restricao.vegana, true)
    await chip.focus()
    await expect(chip).toBeFocused()
    await page.keyboard.press("Space")
    await expect(chip).toHaveAttribute("aria-pressed", "true")
  })

  test("só com teclado: o foco chega à confirmação e Esc devolve", async ({ page }) => {
    await abrirVoce(page)
    const tirar = botao(page, "Tirar Castanhas")
    await tirar.focus()
    await page.keyboard.press("Enter")
    await expect(confirmacao(page)).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() => document.activeElement?.closest("[role=alertdialog]") !== null),
      )
      .toBe(true)
    await page.keyboard.press("Escape")
    await expect(confirmacao(page)).toHaveCount(0)
  })
})

test.describe("acessibilidade e zoom", () => {
  for (const tema of TEMAS) {
    test(`cheia, folhas e confirmações, tema ${tema}`, async ({ context, page }) => {
      test.setTimeout(90_000)
      await usarTema(context, tema)
      await abrirVoce(page)
      await expectSemViolacoes(page)

      await page.getByRole("tab", { name: "Pitta" }).click()
      await expectSemViolacoes(page)

      await botao(page, T.dosha.mudar).first().click()
      await assentar(page)
      await expectSemViolacoes(page)
      await page.keyboard.press("Escape")

      await botao(page, T.fixos.adicionar).nth(0).click()
      await assentar(page)
      await expectSemViolacoes(page)
      await page.keyboard.press("Escape")

      await botao(page, "Tirar Castanhas").click()
      await assentar(page)
      await expectSemViolacoes(page)
      await page.keyboard.press("Escape")

      await botao(page, "Apagar: ontem").click()
      await assentar(page)
      await expectSemViolacoes(page)
      await page.keyboard.press("Escape")

      await botao(page, T.conta.apagar, true).click()
      await assentar(page)
      await expectSemViolacoes(page)
    })

    test(`sem dosha e vazia, tema ${tema}`, async ({ context, page }) => {
      await usarTema(context, tema)
      await abrirVoceSemDosha(page)
      await expectSemViolacoes(page)
    })

    test(`quiz, resultado, tema ${tema}`, async ({ context, page }) => {
      await usarTema(context, tema)
      await abrirVoce(page)
      await page.goto("/voce/quiz")
      await expectSemViolacoes(page)
      await responderQuiz(page)
      await expectSemViolacoes(page)
    })
  }

  test("com 200% de zoom em 1280 px não há rolagem horizontal", async ({ page }) => {
    await abrirVoce(page)
    await page.setViewportSize({ width: 640, height: 450 })
    const sobra = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(sobra).toBeLessThanOrEqual(0)
  })
})

test.describe("screenshots de Você", () => {
  test.skip(!process.env.SCREENSHOTS, "defina SCREENSHOTS=1")
  const caminho = (tela: string, tema: string, projeto: string) =>
    `.plans/020-${tela}-${tema}-${projeto}.png`

  for (const tema of TEMAS) {
    test(`cheia ${tema}`, async ({ context, page }, info) => {
      await usarTema(context, tema)
      await abrirVoce(page)
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({
        path: caminho("voce-cheia", tema, info.project.name),
        fullPage: true,
      })
    })

    test(`sem dosha ${tema}`, async ({ context, page }, info) => {
      await usarTema(context, tema)
      await abrirVoceSemDosha(page)
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({
        path: caminho("voce-sem-dosha", tema, info.project.name),
        fullPage: true,
      })
    })

    test(`vazia ${tema}`, async ({ context, page }, info) => {
      await usarTema(context, tema)
      await abrirVoceSemDosha(page)
      await botao(page, T.semDosha.jaSei).click()
      await dialogo(page).getByText("Vata", { exact: true }).click()
      await dialogo(page).getByRole("button", { name: T.dosha.salvar, exact: true }).click()
      await expect(dialogo(page)).toHaveCount(0)
      await expect(page.getByText(T.dosha.escolhido, { exact: true })).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({
        path: caminho("voce-vazia", tema, info.project.name),
        fullPage: true,
      })
    })

    test(`evitar ${tema}`, async ({ context, page }, info) => {
      await usarTema(context, tema)
      await abrirVoce(page)
      await botao(page, "Tirar Castanhas").click()
      await expect(confirmacao(page)).toBeVisible()
      await assentar(page)
      await page.screenshot({ path: caminho("voce-evitar", tema, info.project.name) })
    })

    test(`quiz resultado ${tema}`, async ({ context, page }, info) => {
      await usarTema(context, tema)
      await abrirVoce(page)
      await page.goto("/voce/quiz")
      await responderQuiz(page)
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({
        path: caminho("quiz-resultado", tema, info.project.name),
        fullPage: true,
      })
    })
  }
})
