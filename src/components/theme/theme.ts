import { config } from "@config/index"

export type Theme = "light" | "dark"
export type ThemeChoice = Theme | "auto"

export const THEME_COOKIE: string = config.ui.theme.cookie

const SEGUNDOS_POR_DIA = 86400

export function parseTheme(value: string | undefined): ThemeChoice {
  if (value === "light" || value === "dark" || value === "auto") return value
  return "auto"
}

export function themeCookie(choice: ThemeChoice): string {
  if (choice === "auto") return `${THEME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
  const maxAge = config.ui.theme.maxAgeDays * SEGUNDOS_POR_DIA
  return `${THEME_COOKIE}=${choice}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
}
