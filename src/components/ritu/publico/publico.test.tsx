import { publico, textosLanding } from "@config/index"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CabecalhoPublico } from "@/components/ritu/publico/cabecalho"
import { RodapePublico } from "@/components/ritu/publico/rodape"

const T = textosLanding

describe("RodapePublico", () => {
  it("marca a página atual com aria-current", () => {
    const html = renderToStaticMarkup(<RodapePublico atual="bastidores" />)
    expect(html).toMatch(/<a[^>]*href="\/bastidores"[^>]*aria-current="page"/)
    expect(html).not.toMatch(/<a[^>]*href="\/sobre"[^>]*aria-current/)
  })

  it("sem página atual não marca nenhum link", () => {
    expect(renderToStaticMarkup(<RodapePublico />)).not.toContain("aria-current")
  })

  it("abre o GitHub em nova aba com rel e texto oculto", () => {
    const html = renderToStaticMarkup(<RodapePublico />)
    expect(html).toContain(`href="${publico.repositorio}"`)
    expect(html).toContain('target="_blank"')
    expect(html).toMatch(/rel="[^"]*noopener/)
    expect(html).toMatch(
      new RegExp(`class="[^"]*sr-only[^"]*">${T.novaAba.replace(/[()]/g, "\\$&")}`),
    )
  })

  it("tem a nav nomeada e a assinatura com o nome", () => {
    const html = renderToStaticMarkup(<RodapePublico />)
    expect(html).toContain('aria-label="Links do Ritu"')
    expect(html).toContain(T.rodape.assinatura.replace("{nome}", publico.autoria.nome))
  })
})

describe("CabecalhoPublico", () => {
  it("leva o logo como link para a raiz", () => {
    const html = renderToStaticMarkup(<CabecalhoPublico />)
    expect(html).toContain("<header")
    expect(html).toContain('href="/"')
  })
})
