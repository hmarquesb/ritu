import { textosSobre } from "@config/index"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { IndiceDoSobre } from "./indice"
import { SecaoDoSobre } from "./secao"

describe("Seção e índice", () => {
  it("a seção é nomeada pelo h2", () => {
    const h = renderToStaticMarkup(
      <SecaoDoSobre id="privacidade" titulo="Privacidade">
        x
      </SecaoDoSobre>,
    )
    expect(h).toContain('id="privacidade"')
    expect(h).toContain('aria-labelledby="privacidade-titulo"')
    expect(h).toContain("scroll-mt")
  })

  it("o índice liga cada seção", () => {
    const h = renderToStaticMarkup(
      <IndiceDoSobre itens={[{ id: "projeto", titulo: "O projeto" }]} />,
    )
    expect(h).toContain(`aria-label="${textosSobre.indice}"`)
    expect(h).toContain('href="#projeto"')
  })
})
