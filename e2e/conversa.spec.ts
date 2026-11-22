import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import type { Locator, Page } from "@playwright/test"
import { expectSemViolacoes } from "./apoio/a11y"
import { entrarComContaNova, entrarNaDemo, expect, test } from "./apoio/sessao"
import { TEMAS, usarTema } from "./apoio/tema"

const T = config.textosConversa

const MSG_PERGUNTA_CASA = "fui à feira ontem, o que faço pro jantar?"
const MSG_TROCA = "quero um chá quente agora"
const MSG_TEXTO_CRU = "mostra um texto estranho"
const MSG_LENTO = "demora um pouco"
const FRASE_DA_TROCA = /Troquei gengibre por canela/

const RESPOSTA_DEMO = "Para uma manhã fria e agitada"
const RESPOSTA_PERGUNTA_CASA = "uma refeição morna de caldo"
const RESPOSTA_TROCA = "Um chá quente de gengibre aquece sem pesar"
const RESPOSTA_LENTO = "Um chá quente de gengibre ajuda a aquecer"

const caixaDe = (page: Page) => page.getByRole("textbox", { name: T.caixa.rotulo })
const enviarDe = (page: Page) => page.getByRole("button", { name: T.caixa.enviar })
const menuDe = (page: Page, item: string) =>
  page.getByRole("button", { name: formatar(T.sugestao.menu, { item }) })
const noLog = (page: Page) => page.getByRole("log", { name: T.abas.conversa })

async function enviarTexto(page: Page, texto: string): Promise<void> {
  await caixaDe(page).fill(texto)
  await enviarDe(page).click()
}

// Espera o run assentar: caixa liberada para a próxima mensagem.
async function esperarCaixaLivre(page: Page): Promise<void> {
  await expect(caixaDe(page)).not.toHaveAttribute("aria-disabled", "true")
}

// Conta nova que já passou pelo onboarding e está na conversa.
async function entrarComContaNovaNaConversa(page: Page): Promise<void> {
  await entrarComContaNova(page)
  await page.waitForURL("**/comecar/evitar")
  await page.getByRole("button", { name: "Nenhum" }).click()
  await page.waitForURL("**/comecar/dosha")
  await page.getByText("Agora não", { exact: true }).click()
  await page.getByRole("button", { name: "Pular a cidade" }).click()
  await page.getByRole("button", { name: "Continuar" }).click()
  await page.waitForURL("**/conversa")
  await expect(caixaDe(page)).toBeVisible()
}

// A lista rola até o começo da resposta com animação; espera a rolagem parar (cinco quadros iguais).
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

// Rola a página até o alvo ficar inteiro acima do painel fixo da caixa (o painel cobre o pé da tela).
async function rolarParaAcimaDoPainel(page: Page, alvo: Locator): Promise<void> {
  await alvo.evaluate((el) => {
    const painel = document.querySelector("textarea")?.closest(".sticky")
    const topoDoPainel = painel ? painel.getBoundingClientRect().top : window.innerHeight
    const folga = 16
    window.scrollBy({
      top: el.getBoundingClientRect().bottom - topoDoPainel + folga,
      behavior: "instant",
    })
  })
  await esperarRolagemParar(page)
}

async function demoAteAResposta(page: Page): Promise<void> {
  await entrarNaDemo(page)
  await expect(caixaDe(page)).not.toHaveValue("")
  await enviarDe(page).click()
  await expect(noLog(page).getByText(RESPOSTA_DEMO)).toBeVisible()
  await expect(page.getByText(T.bloco.titulo)).toBeVisible()
}

test.describe("demonstração até a resposta", () => {
  test("em três toques, só com cliques", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Testar com perfil de demonstração" }).click()
    await page.getByRole("button", { name: "Entendi, quero começar" }).click()
    await page.waitForURL("**/conversa")
    // A caixa já vem com a mensagem sugerida pelo perfil.
    await expect(caixaDe(page)).not.toHaveValue("")
    await enviarDe(page).click()

    await expect(noLog(page).getByText(RESPOSTA_DEMO)).toBeVisible()
    await expect(page.getByRole("heading", { name: "Banho morno" })).toBeVisible()
    await expect(page.getByText(formatar(T.paraTer.rotulo, { item: "cardamomo" }))).toBeVisible()
    await expect(page.getByRole("heading", { name: T.bloco.titulo })).toBeVisible()
    await expect(page.getByText(T.rodape.aviso)).toBeVisible()

    // Etapas recolhem em "Pensei em N passos" com o caminho para "Como pensei".
    await expect(page.getByText(/Pensei em \d+ passos?/)).toBeVisible()
    await expect(page.getByRole("link", { name: T.etapas.comoPensei })).toBeVisible()
    await esperarCaixaLivre(page)
  })

  test("a resposta é anunciada uma vez", async ({ page }) => {
    await demoAteAResposta(page)
    await esperarCaixaLivre(page)
    await expect(page.locator('[aria-live="polite"]', { hasText: RESPOSTA_DEMO })).toHaveCount(1)
  })

  test("só com teclado", async ({ page }) => {
    await page.goto("/")
    const demo = page.getByRole("button", { name: "Testar com perfil de demonstração" })
    await demo.focus()
    await page.keyboard.press("Enter")
    const entendi = page.getByRole("button", { name: "Entendi, quero começar" })
    await entendi.focus()
    await page.keyboard.press("Enter")
    await page.waitForURL("**/conversa")
    await expect(caixaDe(page)).not.toHaveValue("")
    await caixaDe(page).focus()
    await page.keyboard.press("Enter")
    await expect(noLog(page).getByText(RESPOSTA_DEMO)).toBeVisible()
    await expect(page.getByText(T.bloco.titulo)).toBeVisible()
  })
})

test.describe("caixa de mensagem", () => {
  // O modo e2e só entra por demonstração: a "conta nova" é uma demonstração sem a casa semeada, e por isso
  // a caixa traz a mensagem sugerida. Uma conta Google com a caixa vazia não é alcançável pelo E2E.
  test("conta nova mostra o estado vazio e o texto de apoio", async ({ page }) => {
    await entrarComContaNovaNaConversa(page)
    await expect(page.getByText(T.caixa.apoio)).toBeVisible()
    await expect(page.getByText(T.vazia.titulo)).toBeVisible()
    await expect(page.getByText(T.vazia.texto)).toBeVisible()
    await caixaDe(page).fill("")
    await expect(enviarDe(page)).toHaveAttribute("aria-disabled", "true")
    await expect(page.getByText(T.caixa.vazia)).toBeVisible()
  })

  test("marcar dois atalhos e enviar sem texto", async ({ page }) => {
    await entrarComContaNovaNaConversa(page)
    const frio = page.getByRole("button", { name: "Com frio" })
    const agitada = page.getByRole("button", { name: "Agitada" })
    await frio.click()
    await agitada.click()
    await expect(frio).toHaveAttribute("aria-pressed", "true")
    await expect(agitada).toHaveAttribute("aria-pressed", "true")
    await enviarDe(page).click()
    await expect(page.getByRole("link", { name: T.etapas.comoPensei })).toBeVisible()
    await esperarCaixaLivre(page)
    await expect(caixaDe(page)).toHaveValue("")
    await expect(frio).toHaveAttribute("aria-pressed", "false")
    await expect(agitada).toHaveAttribute("aria-pressed", "false")
  })

  test("durante a resposta a caixa fica avisada e, ao fim, volta vazia", async ({ page }) => {
    await entrarNaDemo(page)
    await page.getByRole("button", { name: "Com frio" }).click()
    await caixaDe(page).fill(MSG_LENTO)
    await caixaDe(page).press("Enter")
    await expect(caixaDe(page)).toHaveAttribute("aria-disabled", "true")
    await expect(caixaDe(page)).toBeFocused()
    await expect(page.getByText(T.caixa.respondendo, { exact: true })).toBeVisible()
    await expect(noLog(page).getByText(RESPOSTA_LENTO)).toBeVisible()
    await esperarCaixaLivre(page)
    await expect(caixaDe(page)).toHaveValue("")
    await expect(page.getByRole("button", { name: "Com frio" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
  })

  test("as etapas aparecem antes da resposta", async ({ page }) => {
    await entrarNaDemo(page)
    await enviarTexto(page, MSG_LENTO)
    await expect(noLog(page).getByText(T.etapas.clima)).toBeVisible()
    await expect(noLog(page).getByText(RESPOSTA_LENTO)).toHaveCount(0)
    await expect(noLog(page).getByText(RESPOSTA_LENTO)).toBeVisible()
    await expect(page.getByText(/Pensei em \d+ passos?/)).toBeVisible()
  })
})

test.describe("pergunta de casa", () => {
  test("responder retoma e entrega a resposta", async ({ page }) => {
    await entrarNaDemo(page)
    await caixaDe(page).fill(MSG_PERGUNTA_CASA)
    await enviarDe(page).click()
    const couve = page.getByRole("radiogroup", { name: "Couve" })
    const leite = page.getByRole("radiogroup", { name: "Leite" })
    await expect(couve).toBeVisible()
    await expect(leite).toBeVisible()
    await couve.getByText("Tenho", { exact: true }).click()
    await leite.getByText("Não tenho", { exact: true }).click()
    await page.getByRole("button", { name: T.pergunta.responder }).click()
    await expect(noLog(page).getByText(RESPOSTA_PERGUNTA_CASA)).toBeVisible()
    await expect(couve).toHaveCount(0)
  })

  test("pular também retoma", async ({ page }) => {
    await entrarNaDemo(page)
    await enviarTexto(page, MSG_PERGUNTA_CASA)
    await expect(page.getByRole("radiogroup", { name: "Couve" })).toBeVisible()
    await page.getByRole("button", { name: T.pergunta.pular }).click()
    await expect(noLog(page).getByText(RESPOSTA_PERGUNTA_CASA)).toBeVisible()
    await expect(page.getByRole("radiogroup", { name: "Couve" })).toHaveCount(0)
  })
})

test.describe("bloco de aprovação", () => {
  test("aprovar um e recusar outro", async ({ page }) => {
    await demoAteAResposta(page)
    const linhas = page.getByRole("checkbox", { name: /^Anotar:/ })
    const total = await linhas.count()
    expect(total).toBeGreaterThan(1)
    await page
      .locator("label")
      .filter({ hasText: /^Anotar:/ })
      .nth(1)
      .click()
    await expect(linhas.nth(1)).not.toBeChecked()
    await page.getByRole("button", { name: T.bloco.anotar, exact: true }).click()
    await expect(page.getByText(formatar(T.bloco.anotei, { n: total - 1, m: total }))).toBeVisible()
    await expect(page.getByRole("checkbox", { name: /^Anotar:/ })).toHaveCount(0)
  })

  test("Agora não", async ({ page }) => {
    await demoAteAResposta(page)
    await page.getByRole("button", { name: T.bloco.agoraNao }).click()
    await expect(page.getByText(T.bloco.nada)).toBeVisible()
  })
})

test.describe("troca e voto", () => {
  test("Trocar mostra o substituto e a frase", async ({ page }) => {
    await entrarNaDemo(page)
    await enviarTexto(page, MSG_TROCA)
    await expect(noLog(page).getByText(RESPOSTA_TROCA)).toBeVisible()
    await menuDe(page, "Gengibre").click()
    await page.getByRole("menuitem", { name: "Trocar" }).click()
    await expect(menuDe(page, "Canela")).toBeVisible()
    await expect(page.getByText(FRASE_DA_TROCA)).toBeVisible()
    await expect(menuDe(page, "Gengibre")).toHaveCount(0)
  })

  test("Não tenho abre a pergunta da troca", async ({ page }) => {
    await entrarNaDemo(page)
    await enviarTexto(page, MSG_TROCA)
    await expect(noLog(page).getByText(RESPOSTA_TROCA)).toBeVisible()
    await menuDe(page, "Gengibre").click()
    await page.getByRole("menuitem", { name: "Trocar" }).click()
    await expect(menuDe(page, "Canela")).toBeVisible()
    // Cada "Não tenho" no substituto atual leva ao próximo da casa, até sobrar um que a pessoa ainda não confirmou.
    const pergunta = page.getByText(/^Você tem .+\?$/)
    const chip = page.getByRole("button", { name: /^Opções para / }).first()
    for (let volta = 0; volta < 6 && (await pergunta.count()) === 0; volta++) {
      const antes = await chip.getAttribute("aria-label")
      await chip.click()
      await page.getByRole("menuitem", { name: "Não tenho" }).click()
      await expect
        .poll(
          async () =>
            (await pergunta.count()) > 0 || (await chip.getAttribute("aria-label")) !== antes,
        )
        .toBe(true)
    }
    await expect(pergunta).toBeVisible()
    await expect(page.getByRole("button", { name: "Tenho", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Não tenho", exact: true })).toBeVisible()
  })

  test("👍 e troca para 👎; recarregar mantém o voto e o bloco aberto", async ({ page }) => {
    await demoAteAResposta(page)
    const gostei = page.getByRole("button", { name: T.rodape.gostei, exact: true })
    const naoGostei = page.getByRole("button", { name: T.rodape.naoGostei, exact: true })
    await esperarCaixaLivre(page)
    await gostei.click()
    await expect(gostei).toHaveAttribute("aria-pressed", "true")
    await naoGostei.click()
    await expect(naoGostei).toHaveAttribute("aria-pressed", "true")
    await expect(gostei).toHaveAttribute("aria-pressed", "false")

    await page.reload()
    await expect(
      page.getByRole("button", { name: T.rodape.naoGostei, exact: true }),
    ).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByRole("heading", { name: T.bloco.titulo })).toBeVisible()
    await expect(page.getByRole("button", { name: T.bloco.anotar, exact: true })).toBeVisible()
  })

  test("a troca feita continua depois de recarregar", async ({ page }) => {
    await entrarNaDemo(page)
    await enviarTexto(page, MSG_TROCA)
    await expect(noLog(page).getByText(RESPOSTA_TROCA)).toBeVisible()
    await menuDe(page, "Gengibre").click()
    await page.getByRole("menuitem", { name: "Trocar" }).click()
    await expect(page.getByText(FRASE_DA_TROCA)).toBeVisible()
    await page.reload()
    await expect(noLog(page).getByText(RESPOSTA_TROCA)).toBeVisible()
    await expect(menuDe(page, "Canela")).toBeVisible()
    await expect(page.getByText(FRASE_DA_TROCA)).toBeVisible()
  })
})

test.describe("texto da resposta", () => {
  test("`<script>` e `**` aparecem como texto", async ({ page }) => {
    await entrarNaDemo(page)
    await enviarTexto(page, MSG_TEXTO_CRU)
    await expect(noLog(page).getByText("<script>alert(1)</script>")).toBeVisible()
    await expect(noLog(page).getByText("**negrito**")).toBeVisible()
    await expect(page.locator("[data-fala-agente] script")).toHaveCount(0)
    await expect(page.locator("[data-fala-agente] strong")).toHaveCount(0)
  })
})

test.describe("recarregar e outras abas", () => {
  test("recarregar no meio mostra que o Ritu ainda responde e depois a resposta", async ({
    page,
  }) => {
    await entrarNaDemo(page)
    await enviarTexto(page, MSG_LENTO)
    await expect(noLog(page).getByText(T.etapas.clima)).toBeVisible()
    await page.reload()
    await expect(page.getByText(T.etapas.ainda)).toBeAttached()
    await expect(noLog(page).getByText(RESPOSTA_LENTO)).toBeVisible()
    await expect(page.getByText(T.etapas.ainda)).toHaveCount(0)
  })

  test("enviar com run aberto em outra aba avisa", async ({ context, page }) => {
    await entrarNaDemo(page)
    // A segunda aba abre antes, com a caixa livre; depois a primeira abre o run lento.
    const outra = await context.newPage()
    await outra.goto("/conversa")
    await expect(caixaDe(outra)).toBeVisible()
    await enviarTexto(page, MSG_LENTO)
    // O run existe desde a primeira etapa; a segunda aba envia logo, enquanto o lento ainda tem passos por fazer.
    await expect(noLog(page).getByText(T.etapas.entendendo)).toBeVisible()
    await enviarTexto(outra, "oi de novo")
    await expect(outra.getByText(T.erro.run_aberto)).toBeVisible()
    await expect(noLog(page).getByText(RESPOSTA_LENTO)).toBeVisible()
    await outra.close()
  })

  test("mensagem sem roteiro mostra a resposta de cota esgotada", async ({ page }) => {
    await entrarNaDemo(page)
    await enviarTexto(page, "oi")
    await expect(noLog(page).getByText(/Meu limite de conversas de hoje acabou/)).toBeVisible()
    await expect(page.getByText(T.rodape.aviso)).toBeVisible()
  })

  test("POST /api/runs com Origin de outro site é recusado", async ({ page }) => {
    await entrarNaDemo(page)
    const resposta = await page.request.post("/api/runs", {
      headers: { origin: "https://outro-site.example" },
      data: { texto: "oi" },
    })
    expect(resposta.status()).toBe(403)
  })

  test("falha de rede mostra o erro e deixa tentar de novo", async ({ page }) => {
    await entrarNaDemo(page)
    await page.route("**/api/runs", (rota) => rota.abort())
    await enviarTexto(page, "oi")
    await expect(page.getByText(T.erro.rede)).toBeVisible()
    await expect(page.getByRole("button", { name: T.erro.tentar })).toBeVisible()
  })
})

test.describe("retornos e barra", () => {
  test("o indicador de retornos leva a /como-ficou", async ({ page }) => {
    await entrarNaDemo(page)
    const indicador = page.getByRole("link", { name: /sugest(ão|ões) esperando seu retorno/ })
    await expect(indicador).toBeVisible()
    await expect(indicador).toHaveText(/^\d+ sugest/)
    await indicador.click()
    await page.waitForURL("**/como-ficou")
  })

  test("as quatro abas levam às telas, com aria-current certo", async ({ page }, info) => {
    await entrarNaDemo(page)
    const barra = page.getByRole("navigation", { name: T.abas.rotulo })
    const abas = [
      { nome: T.abas.conversa, url: "/conversa" },
      { nome: T.abas.casa, url: "/casa" },
      { nome: T.abas.comoFicou, url: "/como-ficou" },
      { nome: T.abas.voce, url: "/voce" },
    ]
    for (const aba of abas) {
      await barra.getByRole("link", { name: aba.nome }).click()
      await page.waitForURL(`**${aba.url}`)
      await expect(barra.getByRole("link", { name: aba.nome })).toHaveAttribute(
        "aria-current",
        "page",
      )
      await expect(barra.locator('[aria-current="page"]')).toHaveCount(1)
    }
    const caixa = await barra.boundingBox()
    const janela = page.viewportSize()
    if (!caixa || !janela) throw new Error("sem medidas")
    if (info.project.name === "desktop") {
      // Lateral: encostada à esquerda do conteúdo, mais alta que larga.
      expect(caixa.width).toBeLessThan(janela.width / 2)
      expect(caixa.height).toBeGreaterThan(caixa.width)
    } else {
      // Embaixo: ocupa a largura toda e encosta no pé da tela.
      expect(caixa.width).toBeGreaterThanOrEqual(janela.width - 1)
      expect(caixa.y + caixa.height).toBeGreaterThanOrEqual(janela.height - 1)
    }
  })

  test("200% de zoom em 1280 px: sem rolagem horizontal e com a caixa visível", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 640, height: 450 })
    await entrarNaDemo(page)
    await expect(caixaDe(page)).toBeVisible()
    await expect(enviarDe(page)).toBeVisible()
    const sobra = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(sobra).toBeLessThanOrEqual(0)
  })
})

for (const tema of TEMAS) {
  test.describe(`axe na conversa, tema ${tema}`, () => {
    test("vazia e erro", async ({ context, page }) => {
      await usarTema(context, tema)
      await entrarComContaNovaNaConversa(page)
      await expect(page.getByText(T.vazia.titulo)).toBeVisible()
      await expectSemViolacoes(page)

      await page.route("**/api/runs", (rota) => rota.abort())
      await enviarTexto(page, "oi")
      await expect(page.getByText(T.erro.rede)).toBeVisible()
      await expectSemViolacoes(page)
    })

    test("respondendo", async ({ context, page }) => {
      await usarTema(context, tema)
      await entrarNaDemo(page)
      await enviarTexto(page, MSG_LENTO)
      await expect(page.getByText(T.caixa.respondendo, { exact: true })).toBeVisible()
      await expectSemViolacoes(page)
      await expect(noLog(page).getByText(RESPOSTA_LENTO)).toBeVisible()
    })

    test("pergunta", async ({ context, page }) => {
      await usarTema(context, tema)
      await entrarNaDemo(page)
      await enviarTexto(page, MSG_PERGUNTA_CASA)
      await expect(page.getByRole("radiogroup", { name: "Couve" })).toBeVisible()
      await expectSemViolacoes(page)
    })

    test("resposta com bloco, abas e Como pensei", async ({ context, page }) => {
      await usarTema(context, tema)
      await demoAteAResposta(page)
      await esperarCaixaLivre(page)
      await esperarRolagemParar(page)
      await expectSemViolacoes(page)

      await page.getByRole("link", { name: T.etapas.comoPensei }).click()
      await page.waitForURL("**/como-pensei/**")
      await expect(page.getByRole("heading", { name: T.comoPensei.titulo })).toBeVisible()
      await expectSemViolacoes(page)

      for (const url of ["/casa", "/como-ficou", "/voce", "/conversa"]) {
        await page.goto(url)
        await expect(page.getByRole("navigation", { name: T.abas.rotulo })).toBeVisible()
        await expectSemViolacoes(page)
      }
    })
  })
}

test.describe("screenshots da Conversa", () => {
  test.skip(!process.env.SCREENSHOTS, "defina SCREENSHOTS=1")
  const caminho = (estado: string, tema: string, projeto: string) =>
    `.plans/018-${estado}-${tema}-${projeto}.png`

  for (const tema of TEMAS) {
    test(`vazia ${tema}`, async ({ context, page }, info) => {
      await usarTema(context, tema)
      await entrarComContaNovaNaConversa(page)
      await expect(page.getByText(T.vazia.titulo)).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: caminho("vazia", tema, info.project.name) })
    })

    test(`respondendo ${tema}`, async ({ context, page }, info) => {
      await usarTema(context, tema)
      await entrarNaDemo(page)
      await enviarTexto(page, MSG_LENTO)
      await expect(noLog(page).getByText(T.etapas.clima)).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: caminho("respondendo", tema, info.project.name) })
    })

    test(`pergunta ${tema}`, async ({ context, page }, info) => {
      await usarTema(context, tema)
      await entrarNaDemo(page)
      await enviarTexto(page, MSG_PERGUNTA_CASA)
      await expect(page.getByRole("radiogroup", { name: "Couve" })).toBeVisible()
      await rolarParaAcimaDoPainel(page, page.getByRole("button", { name: T.pergunta.responder }))
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: caminho("pergunta", tema, info.project.name) })
    })

    test(`resposta-bloco ${tema}`, async ({ context, page }, info) => {
      await usarTema(context, tema)
      await demoAteAResposta(page)
      await esperarCaixaLivre(page)
      await rolarParaAcimaDoPainel(page, page.getByRole("button", { name: T.bloco.agoraNao }))
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: caminho("resposta-bloco", tema, info.project.name) })
    })
  }
})
