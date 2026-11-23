import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { SugestaoNaTela } from "@/core/conversation/visao"
import { BlocoDeSugestao } from "./sugestao"

const sugestao: SugestaoNaTela = {
  posicao: 1,
  tipo: "cha",
  titulo: "Chá de gengibre com canela",
  como_fazer: "Ferva e beba morno.",
  itens: [{ alimento_id: "gengibre", nome: "Gengibre", verbos: ["aquece"], incerto: false }],
  verbos: ["aquece"],
  motivo: "Porque aquece.",
  novidade: false,
  podeTrocar: true,
}

describe("BlocoDeSugestao exemplo", () => {
  const html = renderToStaticMarkup(<BlocoDeSugestao sugestao={sugestao} exemplo />)

  it("mostra título, como fazer e ingrediente parado", () => {
    expect(html).toContain("Chá de gengibre com canela")
    expect(html).toContain("Ferva e beba morno.")
    expect(html).toContain("Gengibre")
  })

  it("não tem botões, menu, verbos nem avaliação", () => {
    expect(html).not.toContain("<button")
    expect(html).not.toContain("aria-haspopup")
    expect(html).not.toContain("aquece")
    expect(html).not.toMatch(/👍|👎/)
  })

  it("sem exemplo continua com o botão do porquê", () => {
    expect(renderToStaticMarkup(<BlocoDeSugestao sugestao={sugestao} />)).toContain("<button")
  })
})
