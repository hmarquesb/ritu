import { config } from "@config/index"
import { publico } from "@config/publico"
import type { Metadata, Viewport } from "next"
import { cookies, headers } from "next/headers"
import type { ReactNode } from "react"
import { ToastRegion } from "@/components/base/toast"
import { cx } from "@/components/cx"
import { parseTheme, THEME_COOKIE } from "@/components/theme/theme"
import { bodyFont, titleFont } from "./fonts"
import "./globals.css"

const tituloPadrao = "Ritu · agente ayurvédico para o seu momento"
const imagemDeCompartilhamento = {
  url: "/marca/og.jpg",
  width: 1200,
  height: 630,
  alt: "Ritu, agente ayurvédico para o seu momento",
}

export const metadata: Metadata = {
  title: { default: tituloPadrao, template: "%s · Ritu" },
  description: config.textosEntrada.entrada.oQueE,
  metadataBase: publico.siteUrl ? new URL(publico.siteUrl) : undefined,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Ritu",
    title: tituloPadrao,
    description: config.textosEntrada.entrada.oQueE,
    images: [imagemDeCompartilhamento],
  },
  twitter: {
    card: "summary_large_image",
    images: [imagemDeCompartilhamento],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: config.ui.theme.colorLight },
    { media: "(prefers-color-scheme: dark)", color: config.ui.theme.colorDark },
  ],
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const choice = parseTheme((await cookies()).get(THEME_COOKIE)?.value)
  // O React Aria injeta <style> em tempo de execução e lê o nonce desta meta.
  const nonce = (await headers()).get("x-nonce") ?? undefined
  return (
    <html
      lang="pt-BR"
      data-theme={choice === "auto" ? undefined : choice}
      className={cx(titleFont.variable, bodyFont.variable)}
    >
      <head>{nonce ? <meta name="csp-nonce" content={nonce} /> : null}</head>
      <body>
        <a
          href="#conteudo"
          className="absolute left-4 top-2 z-50 -translate-y-[200%] rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary focus:translate-y-0"
        >
          Pular para o conteúdo
        </a>
        {children}
        <ToastRegion />
      </body>
    </html>
  )
}
