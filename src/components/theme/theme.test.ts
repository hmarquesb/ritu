import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import { parseTheme, THEME_COOKIE, themeCookie } from "./theme"

describe("parseTheme", () => {
  it("aceita light, dark e auto", () => {
    expect(parseTheme("light")).toBe("light")
    expect(parseTheme("dark")).toBe("dark")
    expect(parseTheme("auto")).toBe("auto")
  })

  it("trata ausente e vazio como auto", () => {
    expect(parseTheme(undefined)).toBe("auto")
    expect(parseTheme("")).toBe("auto")
  })

  it("trata valor desconhecido como auto", () => {
    expect(parseTheme("DARK")).toBe("auto")
    expect(parseTheme("blue")).toBe("auto")
  })
})

describe("themeCookie", () => {
  it("grava dark com validade de 365 dias em segundos", () => {
    expect(themeCookie("dark")).toBe("ritu_theme=dark; Path=/; Max-Age=31536000; SameSite=Lax")
  })

  it("grava light com validade de 365 dias em segundos", () => {
    expect(themeCookie("light")).toBe("ritu_theme=light; Path=/; Max-Age=31536000; SameSite=Lax")
  })

  it("apaga o cookie no auto", () => {
    expect(themeCookie("auto")).toBe("ritu_theme=; Path=/; Max-Age=0; SameSite=Lax")
  })
})

describe("THEME_COOKIE", () => {
  it("é o nome do cookie da configuração", () => {
    expect(THEME_COOKIE).toBe("ritu_theme")
    expect(config.ui.theme.cookie).toBe(THEME_COOKIE)
  })
})
