import { textosAlertas } from "@config/textos-alertas"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import Sobre from "./page"

afterEach(() => vi.unstubAllEnvs())

describe("/sobre", () => {
  it("traz o h1, as seis seções e os textos fixos de Cuidados", () => {
    vi.stubEnv("CONTATO_PRIVACIDADE", "")
    const h = renderToStaticMarkup(<Sobre />)
    expect(h).toContain("<h1")
    expect(h.match(/<h2/g)).toHaveLength(6)
    expect(h).toContain(textosAlertas.fisico)
    expect(h).toContain(textosAlertas.emocional)
    expect(h).not.toContain("mailto:")
  })

  it("com CONTATO_PRIVACIDADE válida, tem mailto", () => {
    vi.stubEnv("CONTATO_PRIVACIDADE", "oi@exemplo.com")
    expect(renderToStaticMarkup(<Sobre />)).toContain('href="mailto:oi@exemplo.com"')
  })
})
