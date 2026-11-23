import { randomUUID } from "node:crypto"
import type { Locator, Page } from "@playwright/test"
import { expectSemViolacoes } from "./apoio/a11y"
import { entrarComContaNova, expect, test } from "./apoio/sessao"
import { TEMAS, usarTema } from "./apoio/tema"

const BOTAO_ENTENDI = "Entendi, quero começar"
const BOTAO_DEMO = "Testar com perfil de demonstração"

// Espera a navegação assentar: título no ar e o anúncio do botão pendente já removido.
async function aguardarAssentar(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle")
  await expect(page).toHaveTitle("Ritu · agente ayurvédico para o seu momento")
  await expect(page.locator('[role="log"] [role="img"]')).toHaveCount(0)
}

// Conta nova parada no Aviso. `entrarComContaNova` já clica "Entendi" ao chegar (é o botão do Aviso),
// então quem precisa ver o Aviso entra por aqui, com id de isolamento próprio.
async function entrarNoAviso(page: Page): Promise<void> {
  await page
    .context()
    .setExtraHTTPHeaders({ "x-ritu-e2e": randomUUID(), "x-ritu-e2e-conta": "nova" })
  await page.goto("/")
  await page.getByRole("button", { name: BOTAO_DEMO }).first().click()
  await page.waitForURL("**/comecar/aviso")
  await aguardarAssentar(page)
}

// Conta nova já no passo Evitar (o helper compartilhado aceita o Aviso).
async function entrarNoEvitar(page: Page): Promise<void> {
  await entrarComContaNova(page)
  await page.waitForURL("**/comecar/evitar")
  await aguardarAssentar(page)
}

async function aceitarAviso(page: Page): Promise<void> {
  await page.getByRole("button", { name: BOTAO_ENTENDI }).click()
  await page.waitForURL("**/comecar/evitar")
  await aguardarAssentar(page)
}

async function pularEvitar(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Pular" }).click()
  await page.waitForURL("**/comecar/dosha")
  await aguardarAssentar(page)
}

async function irParaDosha(page: Page): Promise<void> {
  await entrarNoAviso(page)
  await aceitarAviso(page)
  await pularEvitar(page)
}

async function escolherOpcao(page: Page, nome: string): Promise<void> {
  await page.getByText(nome, { exact: true }).click()
}

async function digitarEEscolher(page: Page, campo: Locator, termo: string, opcao: string) {
  await campo.pressSequentially(termo)
  const op = page.getByRole("option", { name: opcao })
  // O React Aria mostra a lista invisível (opacity 0 e clip-path) enquanto a
  // posiciona; só clique quando a opção for de fato o alvo do ponteiro.
  await expect
    .poll(() =>
      op.evaluate((el) => {
        const r = el.getBoundingClientRect()
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
      }),
    )
    .toBe(true)
  await op.click()
}

async function buscarECidade(page: Page, termo: string, nome: string): Promise<void> {
  const campo = page.getByRole("combobox", { name: "Buscar cidade" })
  await digitarEEscolher(page, campo, termo, nome)
  await expect(campo).toHaveValue(nome)
}

async function responderQuiz(page: Page, doshas: string[]): Promise<void> {
  for (const [i, dosha] of doshas.entries()) {
    await expect(page.getByText(`Pergunta ${i + 1} de 8`)).toBeVisible()
    await page
      .locator("label")
      .filter({ has: page.locator(`input[value="${dosha}"]`) })
      .click()
    const ultima = i === TOTAL_PERGUNTAS - 1
    await page.getByRole("button", { name: ultima ? "Ver resultado" : "Próxima" }).click()
  }
}

const TOTAL_PERGUNTAS = 8
const RESPOSTAS_DUAL = ["vata", "vata", "vata", "vata", "pitta", "pitta", "pitta", "kapha"]

test.describe("onboarding de conta nova", () => {
  test("Evitar com grupo, alimento da busca e texto livre, depois Dosha Misto e cidade", async ({
    page,
  }) => {
    await entrarNoAviso(page)
    await aceitarAviso(page)

    const pronto = page.getByRole("button", { name: "Pronto", exact: true })
    await expect(pronto).toHaveAttribute("aria-disabled", "true")

    await page
      .getByRole("group", { name: "Grupos de alimentos" })
      .getByRole("button")
      .first()
      .click()
    const busca = page.getByRole("combobox", { name: "Buscar um alimento" })
    await digitarEEscolher(page, busca, "bana", "Banana")
    await expect(page.getByRole("option")).toHaveCount(0)
    await expect(page.getByText("Banana", { exact: true })).toBeVisible()
    await page.getByRole("textbox", { name: "Outro alimento" }).fill("jiló")
    await page.getByRole("button", { name: "Adicionar" }).click()
    await expect(page.getByText("Escolhidos (3 de", { exact: false })).toBeVisible()
    await expect(pronto).not.toHaveAttribute("aria-disabled", "true")
    await pronto.click()
    await page.waitForURL("**/comecar/dosha")

    await escolherOpcao(page, "Já sei meu dosha")
    await escolherOpcao(page, "Misto")
    const continuar = page.getByRole("button", { name: "Continuar" })
    await expect(continuar).toHaveAttribute("aria-disabled", "true")
    const chips = page.getByRole("group", { name: "Escolha dois dos três." })
    await chips.getByRole("button").nth(0).click()
    await chips.getByRole("button").nth(1).click()
    await buscarECidade(page, "rio", "Rio de Janeiro, RJ, Brasil")
    await continuar.click()
    await page.waitForURL("**/conversa")
  })

  test("Nenhum, Agora não e cidade pulada levam à conversa", async ({ page }) => {
    await entrarNoEvitar(page)
    await page.getByRole("button", { name: "Nenhum" }).click()
    await page.waitForURL("**/comecar/dosha")
    await escolherOpcao(page, "Agora não")
    await page.getByRole("button", { name: "Pular a cidade" }).click()
    await page.getByRole("button", { name: "Continuar" }).click()
    await page.waitForURL("**/conversa")
  })

  test("recarregar no meio volta ao mesmo passo", async ({ page }) => {
    await entrarNoAviso(page)
    await aceitarAviso(page)
    await page.reload()
    await expect(page).toHaveURL(/\/comecar\/evitar$/)
    await pularEvitar(page)
    await page.reload()
    await expect(page).toHaveURL(/\/comecar\/dosha$/)
  })

  test("quem terminou e abre /comecar/aviso vai para a conversa", async ({ page }) => {
    await irParaDosha(page)
    await escolherOpcao(page, "Agora não")
    await page.getByRole("button", { name: "Continuar" }).click()
    await page.waitForURL("**/conversa")
    await page.goto("/comecar/aviso")
    await expect(page).toHaveURL(/\/conversa$/)
  })
})

test.describe("quiz", () => {
  test("resultado dual com 4 vata, 3 pitta e 1 kapha", async ({ page }) => {
    await irParaDosha(page)
    await escolherOpcao(page, "Fazer o quiz")
    await page.getByRole("button", { name: "Continuar" }).click()
    await page.waitForURL("**/comecar/quiz")
    await responderQuiz(page, RESPOSTAS_DUAL)
    await expect(page.getByRole("heading", { level: 1, name: /Seu dosha é/ })).toBeVisible()
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(2)
    await page.getByRole("button", { name: "Continuar" }).click()
    await page.waitForURL("**/conversa")
  })

  test("recarregar no meio do quiz continua no quiz", async ({ page }) => {
    await irParaDosha(page)
    await escolherOpcao(page, "Fazer o quiz")
    await page.getByRole("button", { name: "Continuar" }).click()
    await page.waitForURL("**/comecar/quiz")
    await responderQuiz(page, ["vata", "vata"])
    await page.reload()
    await expect(page).toHaveURL(/\/comecar\/quiz$/)
  })
})

for (const tema of TEMAS) {
  test.describe(`axe no onboarding, tema ${tema}`, () => {
    test("Aviso, Evitar, Dosha, Quiz e resultado", async ({ context, page }) => {
      await usarTema(context, tema)
      await entrarNoAviso(page)
      await aguardarAssentar(page)
      await expectSemViolacoes(page)

      await aceitarAviso(page)
      await aguardarAssentar(page)
      await expectSemViolacoes(page)

      await pularEvitar(page)
      await aguardarAssentar(page)
      await escolherOpcao(page, "Já sei meu dosha")
      await escolherOpcao(page, "Misto")
      await expectSemViolacoes(page)

      await escolherOpcao(page, "Fazer o quiz")
      await page.getByRole("button", { name: "Continuar" }).click()
      await page.waitForURL("**/comecar/quiz")
      await aguardarAssentar(page)
      await expectSemViolacoes(page)

      await responderQuiz(page, RESPOSTAS_DUAL)
      await expect(page.getByRole("heading", { level: 1, name: /Seu dosha é/ })).toBeVisible()
      await expectSemViolacoes(page)
    })
  })
}

test.describe("screenshots do onboarding", () => {
  test("aviso, evitar, dosha e resultado do quiz, claro", async ({ context, page }, info) => {
    await usarTema(context, "light")
    const caminho = (nome: string) => `.plans/017-${nome}-light-${info.project.name}.png`
    const foto = async (nome: string) => {
      await aguardarAssentar(page)
      await page.evaluate(() => document.fonts.ready)
      if (info.project.name === "celular") await page.screenshot({ path: caminho(nome) })
    }

    await entrarNoAviso(page)
    await foto("aviso")
    await aceitarAviso(page)
    await foto("evitar")
    await pularEvitar(page)
    await escolherOpcao(page, "Fazer o quiz")
    await foto("dosha")
    await page.getByRole("button", { name: "Continuar" }).click()
    await page.waitForURL("**/comecar/quiz")
    await responderQuiz(page, RESPOSTAS_DUAL)
    await expect(page.getByRole("heading", { level: 1, name: /Seu dosha é/ })).toBeVisible()
    await foto("quiz-resultado")
  })
})
