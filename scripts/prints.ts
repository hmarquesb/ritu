// Gera os prints de `.docs/prints/` no modo e2e: sobe o build (`npm run start`), tira o PNG com o Playwright e grava WebP até 250 KB. Precisa do build e do Chromium do Playwright; fora da CI.
import { type ChildProcess, spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { config, textosBastidores, textosCasa, textosComoPensei, textosVoce } from "@config/index"
import {
  type Browser,
  type BrowserContext,
  chromium,
  expect,
  type Locator,
  type Page,
} from "@playwright/test"
import sharp from "sharp"
import { entrarNaDemo } from "../e2e/apoio/sessao"
import { type Codificacao, codificarAteCaber } from "./lib/prints"

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SAIDA = resolve(RAIZ, ".docs/prints")
const PORTA_PADRAO = 3200
const LARGURA_MAXIMA = 1600
const TEMPO_DE_SUBIDA_MS = 120_000

const T_CONVERSA = config.textosConversa
const T_COMO_PENSEI = textosComoPensei
const CAIXA = (page: Page) => page.getByRole("textbox", { name: T_CONVERSA.caixa.rotulo })
const VIEWPORTS = {
  celular: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
}

type Dispositivo = keyof typeof VIEWPORTS
type Tema = "light" | "dark"
type Print = {
  arquivo: string
  dispositivo: Dispositivo
  tema: Tema
  inteira?: boolean
  preparar: (page: Page, baseURL: string) => Promise<void>
}

async function enviarMensagemSugerida(page: Page): Promise<void> {
  await expect(CAIXA(page)).not.toHaveValue("")
  await page.getByRole("button", { name: T_CONVERSA.caixa.enviar }).click()
  await expect(page.getByText(T_CONVERSA.bloco.titulo)).toBeVisible({ timeout: 30_000 })
  await expect(CAIXA(page)).not.toHaveAttribute("aria-disabled", "true")
}

// Espera a rolagem parar (cinco quadros iguais) para a captura não pegar a tela no meio do movimento.
// Texto puro: a função em string não passa pelo transform do tsx, que injeta helpers que o navegador não tem.
const ESPERA_ROLAGEM = `new Promise((resolver) => {
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
})`

async function esperarRolagemParar(page: Page): Promise<void> {
  await page.evaluate(ESPERA_ROLAGEM)
}

// Rola até o alvo ficar inteiro acima do painel fixo da caixa, que cobre o pé da tela.
async function rolarParaAcimaDoPainel(page: Page, alvo: Locator): Promise<void> {
  await alvo.evaluate((el) => {
    const painel = document.querySelector("textarea")?.closest(".sticky")
    const topoDoPainel = painel ? painel.getBoundingClientRect().top : window.innerHeight
    window.scrollBy({
      top: el.getBoundingClientRect().bottom - topoDoPainel + 16,
      behavior: "instant",
    })
  })
  await esperarRolagemParar(page)
}

async function conversaComResposta(page: Page): Promise<void> {
  await entrarNaDemo(page)
  await enviarMensagemSugerida(page)
  await rolarParaAcimaDoPainel(page, page.getByRole("button", { name: T_CONVERSA.bloco.agoraNao }))
}

async function casaDaDemo(page: Page): Promise<void> {
  await entrarNaDemo(page)
  await page.goto("/casa")
  await expect(page.getByRole("heading", { level: 1, name: textosCasa.titulo })).toBeVisible()
}

async function comoPenseiDaResposta(page: Page): Promise<void> {
  await entrarNaDemo(page)
  await enviarMensagemSugerida(page)
  await page.getByRole("button", { name: T_CONVERSA.bloco.anotar, exact: true }).click()
  await expect(page.getByRole("checkbox", { name: /^Anotar:/ })).toHaveCount(0)
  await page.getByRole("link", { name: T_CONVERSA.etapas.comoPensei }).click()
  await page.waitForURL("**/como-pensei/**")
  await expect(page.getByRole("heading", { level: 1, name: T_COMO_PENSEI.titulo })).toBeVisible()
}

async function vocePelaDemo(page: Page): Promise<void> {
  await entrarNaDemo(page)
  await page.goto("/voce")
  await expect(page.getByRole("heading", { level: 1, name: textosVoce.titulo })).toBeVisible()
}

async function bastidoresAcimaDoPiso(page: Page, baseURL: string): Promise<void> {
  await page.setExtraHTTPHeaders({ "x-ritu-e2e-bastidores": "ok" })
  await page.goto(new URL("/bastidores", baseURL).toString())
  await expect(page.getByRole("heading", { level: 1, name: textosBastidores.titulo })).toBeVisible()
}

async function entradaSemEntrar(page: Page): Promise<void> {
  await page.goto("/")
  await expect(
    page.getByRole("button", { name: "Testar com perfil de demonstração" }).first(),
  ).toBeVisible()
}

const PRINTS: Print[] = [
  {
    arquivo: "entrada-desktop.webp",
    dispositivo: "desktop",
    tema: "light",
    preparar: entradaSemEntrar,
  },
  {
    arquivo: "conversa-celular.webp",
    dispositivo: "celular",
    tema: "light",
    preparar: conversaComResposta,
  },
  {
    arquivo: "conversa-desktop.webp",
    dispositivo: "desktop",
    tema: "light",
    preparar: conversaComResposta,
  },
  { arquivo: "casa-celular.webp", dispositivo: "celular", tema: "light", preparar: casaDaDemo },
  {
    arquivo: "como-pensei-celular.webp",
    dispositivo: "celular",
    tema: "light",
    inteira: true,
    preparar: comoPenseiDaResposta,
  },
  {
    arquivo: "voce-celular-escuro.webp",
    dispositivo: "celular",
    tema: "dark",
    inteira: true,
    preparar: vocePelaDemo,
  },
  {
    arquivo: "bastidores-desktop.webp",
    dispositivo: "desktop",
    tema: "light",
    inteira: true,
    preparar: bastidoresAcimaDoPiso,
  },
]

async function novoContexto(
  browser: Browser,
  baseURL: string,
  print: Print,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    baseURL,
    viewport: VIEWPORTS[print.dispositivo],
    deviceScaleFactor: 2,
    isMobile: print.dispositivo === "celular",
    hasTouch: print.dispositivo === "celular",
    extraHTTPHeaders: { "x-ritu-e2e": randomUUID() },
  })
  await context.addCookies([{ name: "ritu_theme", value: print.tema, url: baseURL }])
  return context
}

// Uma tentativa por arquivo: o PNG é tirado uma vez, e só a conversão para WebP tenta qualidades.
async function paraWebp(png: Buffer, arquivo: string): Promise<Codificacao> {
  const achado = await codificarAteCaber((qualidade) =>
    sharp(png)
      .resize({ width: LARGURA_MAXIMA, withoutEnlargement: true })
      .webp({ quality: qualidade })
      .toBuffer(),
  )
  if (!achado) throw new Error(`${arquivo} não coube em 250 KB, nem com a qualidade mínima`)
  return achado
}

// Com a página inteira, a barra fixa cai sobre o conteúdo do meio da imagem: escondida só na captura.
// Texto puro pelo mesmo motivo de ESPERA_ROLAGEM.
const ESCONDER_FIXOS = `document.querySelectorAll("body *").forEach((el) => {
  if (getComputedStyle(el).position === "fixed") el.style.setProperty("visibility", "hidden", "important")
})`

async function gerarPrint(browser: Browser, baseURL: string, print: Print): Promise<void> {
  const context = await novoContexto(browser, baseURL, print)
  try {
    const page = await context.newPage()
    await print.preparar(page, baseURL)
    await page.evaluate(() => document.fonts.ready)
    if (print.inteira) await page.evaluate(ESCONDER_FIXOS)
    const png = await page.screenshot({ type: "png", fullPage: print.inteira === true })
    const { qualidade, bytes } = await paraWebp(png, print.arquivo)
    writeFileSync(resolve(SAIDA, print.arquivo), bytes)
    console.log(
      `${print.arquivo}  ${(bytes.byteLength / 1000).toFixed(1)} KB  qualidade ${qualidade}`,
    )
  } finally {
    await context.close()
  }
}

async function porta(baseURL: string): Promise<boolean> {
  return fetch(baseURL).then(
    () => true,
    () => false,
  )
}

function subirServidor(numero: number): ChildProcess {
  return spawn("npm", ["run", "start", "--", "-p", String(numero)], {
    cwd: RAIZ,
    env: {
      ...process.env,
      PORT: String(numero),
      RITU_MODO: "e2e",
      // Valores fixos de teste: não são segredo e só valem para o servidor do E2E.
      AUTH_SECRET: "segredo-de-teste-e2e-nao-e-segredo-0123456789",
      IP_HMAC_SECRET: "ip-hmac-de-teste-e2e-nao-e-segredo-0123456789",
      AUTH_GOOGLE_ID: "",
      AUTH_GOOGLE_SECRET: "",
    },
    detached: true,
    stdio: "ignore",
  })
}

async function esperarServidor(baseURL: string): Promise<void> {
  const limite = Date.now() + TEMPO_DE_SUBIDA_MS
  while (Date.now() < limite) {
    if (await porta(baseURL)) return
    await new Promise((resolver) => setTimeout(resolver, 500))
  }
  throw new Error(`o servidor não respondeu em ${baseURL} (rode npm run build antes)`)
}

function encerrar(servidor: ChildProcess | undefined): void {
  if (servidor?.pid) process.kill(-servidor.pid, "SIGTERM")
}

async function main(): Promise<void> {
  const numero = Number(process.env.PORT ?? PORTA_PADRAO)
  const baseURL = `http://localhost:${numero}`
  if (await porta(baseURL)) throw new Error(`a porta ${numero} já está em uso; passe PORT=<outra>`)

  let servidor: ChildProcess | undefined
  let browser: Browser | undefined
  try {
    servidor = subirServidor(numero)
    await esperarServidor(baseURL)
    mkdirSync(SAIDA, { recursive: true })
    browser = await chromium.launch()
    for (const print of PRINTS) await gerarPrint(browser, baseURL, print)
  } finally {
    await browser?.close()
    encerrar(servidor)
  }
}

main().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : erro)
  process.exitCode = 1
})
