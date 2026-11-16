import { config } from "@config/index"
import type { Metadata, Viewport } from "next"
import { cookies } from "next/headers"
import type { ReactNode } from "react"
import { ToastRegion } from "@/components/base/toast"
import { cx } from "@/components/cx"
import { parseTheme, THEME_COOKIE } from "@/components/theme/theme"
import { bodyFont, titleFont } from "./fonts"
import "./globals.css"

export const metadata: Metadata = {
  title: "Ritu",
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
  return (
    <html
      lang="pt-BR"
      data-theme={choice === "auto" ? undefined : choice}
      className={cx(titleFont.variable, bodyFont.variable)}
    >
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
