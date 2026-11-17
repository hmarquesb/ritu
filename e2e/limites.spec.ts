import { config } from "@config/index"
import type { Page } from "@playwright/test"
import { expectSemViolacoes } from "./apoio/a11y"
import { entrarNaDemo, expect, test } from "./apoio/sessao"
import { TEMAS, usarTema } from "./apoio/tema"

const T = config.textosConversa
const L = config.textosLimites

const RESPOSTA_DEMO = "Para uma manhã fria e agitada"
const MENSAGEM = "quero um chá quente agora"

const caixaDe = (page: Page) => page.getByRole("textbox", { name: T.caixa.rotulo })
const enviarDe = (page: Page) => page.getByRole("button", { name: T.caixa.enviar })
const noLog = (page: Page) => page.getByRole("log", { name: T.abas.conversa })

type Cabecalhos = { teto?: number; cota?: "esgotada" }

// Acrescenta os cabeçalhos do modo e2e a todos os pedidos da página, sem mexer no `x-ritu-e2e` do teste.
// Devolve uma função que troca os cabeçalhos dali em diante.
async function pedirComCabecalhos(
  page: Page,
  inicial: Cabecalhos,
): Promise<(c: Cabecalhos) => void> {
  let atual = inicial
  await page.route("**/*", async (rota) => {
    const headers = { ...rota.request().headers() }
    if (atual.teto !== undefined) headers["x-ritu-e2e-teto"] = String(atual.teto)
    if (atual.cota) headers["x-ritu-e2e-cota"] = atual.cota
    await rota.continue({ headers })
  })
  return (c) => {
    atual = c
  }
}

// A lista rola com animação; espera a rolagem parar (cinco quadros iguais) antes de medir.
async function esperarRolagemParar(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolver) => {
        let ultima = window.scrollY
        let iguais = 0
        const olhar = () => {
          if (window.scrollY === ultima) iguais++
          else {
            ultima = window.scrollY
            iguais = 0
          }
          if (iguais >= 5) resolver()
          else requestAnimationFrame(olhar)
        }
        requestAnimationFrame(olhar)
      }),
  )
}

async function esperarCaixaLivre(page: Page): Promise<void> {
  await expect(caixaDe(page)).not.toHaveAttribute("aria-disabled", "true")
}

// A proposta aberta da resposta segura o run; "Agora não" a fecha e libera a próxima mensagem.
// O teto do modo e2e vale também para os toques: tira-se o teto só enquanto a proposta é decidida.
async function fecharProposta(
  page: Page,
  trocar: (c: Cabecalhos) => void,
  depois: Cabecalhos,
): Promise<void> {
  trocar({})
  const agoraNao = page.getByRole("button", { name: T.bloco.agoraNao, exact: true })
  await agoraNao.click()
  await expect(agoraNao).toHaveCount(0)
  trocar(depois)
}

// Entra pela demonstração com os cabeçalhos já ligados e recarrega a conversa para ler os limites deles.
async function demoComCabecalhos(page: Page, c: Cabecalhos): Promise<(c: Cabecalhos) => void> {
  await entrarNaDemo(page)
  const trocar = await pedirComCabecalhos(page, c)
  await page.goto("/conversa")
  await expect(caixaDe(page)).toBeVisible()
  return trocar
}

test.describe("faixa da cota de IA", () => {
  test("mostra a hora de volta e a caixa continua aceitando texto", async ({ page }) => {
    await demoComCabecalhos(page, { cota: "esgotada" })
    const faixa = page.getByRole("complementary", { name: L.cota.rotulo })
    await expect(faixa).toBeVisible()
    await expect(faixa).toContainText(/Até por volta das \d{1,2}[:h]\d{0,2}/)
    await expect(faixa).not.toContainText("{hora}")
    await caixaDe(page).fill("estou cansada hoje")
    await expect(caixaDe(page)).toHaveValue("estou cansada hoje")
    await expect(enviarDe(page)).not.toHaveAttribute("aria-disabled", "true")
  })

  for (const tema of TEMAS) {
    test(`sem violações de acessibilidade no tema ${tema}`, async ({ page, context }) => {
      await usarTema(context, tema)
      await demoComCabecalhos(page, { cota: "esgotada" })
      await expect(page.getByRole("complementary", { name: L.cota.rotulo })).toBeVisible()
      await expectSemViolacoes(page)
    })
  }
})

test.describe("mensagens restantes", () => {
  test("com teto pequeno, avisa quantas restam na demonstração", async ({ page }) => {
    await demoComCabecalhos(page, { teto: 1 })
    await expect(page.getByText(L.restam.umaDemo, { exact: true })).toBeVisible()
  })

  test("com teto de dois, avisa no plural", async ({ page }) => {
    await demoComCabecalhos(page, { teto: 2 })
    await expect(
      page.getByText("Restam 2 mensagens na demonstração.", { exact: true }),
    ).toBeVisible()
  })
})

test.describe("mensagens esgotadas na demonstração", () => {
  async function esgotar(page: Page): Promise<void> {
    const trocar = await demoComCabecalhos(page, { teto: 1 })
    await expect(caixaDe(page)).not.toHaveValue("")
    await enviarDe(page).click()
    await expect(noLog(page).getByText(RESPOSTA_DEMO)).toBeVisible()
    await fecharProposta(page, trocar, { teto: 1 })
  }

  test("mostra o bloco, sem o botão Google quando ele não está configurado", async ({ page }) => {
    await esgotar(page)
    await expect(page.getByText(L.esgotadas.demo.titulo)).toBeVisible()
    await expect(page.getByText(L.esgotadas.demo.texto)).toBeVisible()
    await expect(page.getByRole("button", { name: L.esgotadas.demo.google })).toHaveCount(0)
    await expect(page.getByRole("button", { name: L.atalhos.enviar })).toBeVisible()
  })

  test("os atalhos seguem funcionando: Ver práticas responde", async ({ page }) => {
    await esgotar(page)
    const respostas = await noLog(page)
      .getByText(/Não é orientação médica|Para uma|prática/i)
      .count()
    await page.getByRole("button", { name: "Com frio" }).click()
    await page.getByRole("button", { name: L.atalhos.enviar }).click()
    await expect(page.getByText(L.esgotadas.demo.titulo)).toBeVisible()
    await expect
      .poll(async () =>
        noLog(page)
          .getByText(/Não é orientação médica|Para uma|prática/i)
          .count(),
      )
      .toBeGreaterThan(respostas)
  })

  for (const tema of TEMAS) {
    test(`sem violações de acessibilidade no tema ${tema}`, async ({ page, context }) => {
      await usarTema(context, tema)
      await esgotar(page)
      await expect(page.getByText(L.esgotadas.demo.titulo)).toBeVisible()
      await esperarRolagemParar(page)
      await expectSemViolacoes(page)
    })
  }
})

test.describe("429 no meio da conversa", () => {
  test("troca a caixa pelo bloco e mantém o texto escrito visível abaixo dele", async ({
    page,
  }) => {
    const trocar = await demoComCabecalhos(page, { teto: 2 })
    await expect(caixaDe(page)).not.toHaveValue("")
    await enviarDe(page).click()
    await expect(noLog(page).getByText(RESPOSTA_DEMO)).toBeVisible()
    await fecharProposta(page, trocar, { teto: 1 })
    await esperarCaixaLivre(page)

    // O teto cai para 1 e a conta já usou 1: o próximo pedido volta 429.
    trocar({ teto: 1 })
    await caixaDe(page).fill(MENSAGEM)
    await enviarDe(page).click()
    await expect(page.getByText(L.esgotadas.demo.titulo)).toBeVisible()
    await expect(page.getByText(L.esgotadas.textoGuardado)).toBeVisible()
    await expect(page.getByText(MENSAGEM, { exact: true })).toBeVisible()
  })
})

test.describe("toques", () => {
  test("o voto barrado pelo limite avisa na conversa", async ({ page }) => {
    const trocar = await demoComCabecalhos(page, {})
    await expect(caixaDe(page)).not.toHaveValue("")
    await enviarDe(page).click()
    await expect(noLog(page).getByText(RESPOSTA_DEMO)).toBeVisible()
    await esperarCaixaLivre(page)
    const gostei = page.getByRole("button", { name: T.rodape.gostei, exact: true })
    const naoGostei = page.getByRole("button", { name: T.rodape.naoGostei, exact: true })
    await gostei.click()
    await expect(gostei).toHaveAttribute("aria-pressed", "true")

    // Teto de 1 toque: o pedido seguinte já passa do limite.
    trocar({ teto: 1 })
    await naoGostei.click()
    await expect(
      page.getByText(new RegExp(`${L.toques.minuto}|${L.toques.dia}`)).first(),
    ).toBeVisible()
  })
})

test.describe("limite de toques em Minha casa", () => {
  test("o toque além do teto mostra o aviso e não muda a tela", async ({ page }) => {
    await entrarNaDemo(page)
    await pedirComCabecalhos(page, { teto: 1 })
    await page.goto("/casa")
    const tenho = page.getByRole("button", { name: /^Ainda tenho / })
    await expect(tenho.first()).toBeVisible()
    await tenho.first().click()
    const alvo = tenho.last()
    const nome = (await alvo.getAttribute("aria-label")) ?? ""
    await alvo.click()
    await expect(page.getByText(new RegExp(`${L.toques.minuto}|${L.toques.dia}`))).toBeVisible()
    await expect(page.getByRole("button", { name: nome })).toBeVisible()
  })
})
