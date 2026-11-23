import { textosSobre } from "@config/index"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { dataPorExtenso, Politica } from "@/components/ritu/sobre/politica"
import { prazosDaPolitica, preencher } from "@/core/publico/prazos"

const prazos = prazosDaPolitica()
const html = (contato: string | null) =>
  renderToStaticMarkup(<Politica contato={contato} prazos={prazos} preencher={preencher} />)

describe("Politica", () => {
  it("com contato, mostra o mailto", () => {
    const h = html("oi@exemplo.com")
    expect(h).toContain('href="mailto:oi@exemplo.com"')
  })

  it("sem contato, não tem mailto e mostra o texto alternativo", () => {
    const h = html(null)
    expect(h).not.toContain("mailto:")
    expect(h).toContain(textosSobre.privacidade.semContato)
    expect(h).not.toContain("{email}")
  })

  it("tem as nove partes com h3", () => {
    expect(html(null).match(/<h3/g)).toHaveLength(9)
  })

  it("interpola os prazos da configuração, sem marcador sobrando", () => {
    const h = html(null)
    expect(h).not.toMatch(/\{[A-Za-z]+\}/)
    expect(h).toContain(`por ${prazos.faltasDias} dias`)
    expect(h).toContain(`${prazos.mensagensDias} dias`)
    expect(h).toContain(`${prazos.demonstracaoHoras} horas`)
    expect(h).toContain(`${prazos.sessaoDias} dias`)
    expect(h).toContain(`${prazos.temaDias} dias`)
    expect(h).toContain(`${prazos.retornosDias} dias`)
  })

  it("mostra a data por extenso", () => {
    expect(dataPorExtenso("2026-11-23")).toBe("23 de novembro de 2026")
    expect(html(null)).toContain("Atualizada em 23 de novembro de 2026.")
  })
})
