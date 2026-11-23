import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Conta } from "@/components/ritu/voce/conta"

describe("Conta", () => {
  it("liga para o Sobre, acima de Sair", () => {
    const html = renderToStaticMarkup(
      <Conta
        conta={{ tipo: "google", horas_restantes: null } as never}
        tema={"sistema" as never}
        googleDisponivel={false}
        criarPerfil={async () => {}}
        sair={async () => {}}
        apagar={async () => {}}
      />,
    )
    expect(html).toMatch(/<a[^>]*href="\/sobre"[^>]*>Sobre o Ritu e privacidade<\/a>/)
    expect(html.indexOf("Sobre o Ritu e privacidade")).toBeLessThan(html.indexOf(">Sair<"))
  })
})
