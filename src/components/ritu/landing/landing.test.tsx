import { exemploDaLanding, textosLanding } from "@config/textos-landing"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { estadoDaEntrada } from "@/core/accounts/entrada"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { ChamadaFinal } from "./chamada-final"
import { ConversaDeExemplo, sugestoesDoExemplo } from "./exemplo"
import { LandingSecoes } from "./secoes"

// Base mínima: o teste dos ids contra a base real fica em config/index.test.ts.
const kb = {
  alimento: (id: string) => ({ id, nome: id === "arroz-branco" ? "Arroz branco" : id }),
  pratica: (id: string) =>
    id === "cha-gengibre-canela"
      ? {
          id,
          tipo: "cha",
          nome: "Chá de gengibre com canela",
          preparo: "Ferva.",
          ingredientes: ["gengibre", "canela"],
        }
      : { id, tipo: "pratica", nome: "Respiração lenta", preparo: "Respire.", ingredientes: [] },
  preparo: (id: string) => ({
    id,
    nome: "Mingau",
    titulo: "Mingau de {base} com {tempero}",
    passos: "Cozinhe.",
  }),
} as unknown as KnowledgeBase
const acao = async () => undefined
const estado = (p: { google: boolean; demosHoje: number }): ReturnType<typeof estadoDaEntrada> => {
  const demo = p.demosHoje < 10
  return demo ? { demo, google: p.google } : { demo, google: p.google, aviso: "demo_limite_global" }
}

describe("ConversaDeExemplo", () => {
  const html = renderToStaticMarkup(<ConversaDeExemplo kb={kb} />)

  it("os ids existem na base e os nomes aparecem no texto do agente", () => {
    for (const ref of exemploDaLanding.sugestoes) {
      const item = ref.tipo === "pratica" ? kb.pratica(ref.id) : kb.preparo(ref.id)
      expect(item, ref.id).toBeDefined()
      for (const id of "ingredientes" in ref ? ref.ingredientes : [])
        expect(kb.alimento(id), id).toBeDefined()
      expect(textosLanding.exemplo.agente.toLocaleLowerCase("pt-BR")).toContain(
        (item?.nome ?? "").toLocaleLowerCase("pt-BR"),
      )
    }
    expect(sugestoesDoExemplo(kb)).toHaveLength(3)
  })

  it("é um figure com figcaption, sem log e sem nada tocável", () => {
    expect(html).toContain("<figure")
    expect(html).toContain(`<figcaption`)
    expect(html).not.toContain('role="log"')
    expect(html).not.toContain("<button")
    expect(html).not.toContain("<a ")
    expect(html).toContain(textosLanding.exemplo.aviso)
  })
})

describe("LandingSecoes", () => {
  it("tem os cinco h2 em ordem", () => {
    const html = renderToStaticMarkup(
      <LandingSecoes
        estado={estado({ google: true, demosHoje: 0 })}
        kb={kb}
        acaoDemo={acao}
        acaoGoogle={acao}
      />,
    )
    const titulos = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((m) => m[1])
    expect(titulos).toEqual([
      "Como funciona",
      "Uma conversa de exemplo",
      "O que ele faz / O que ele não faz",
      "Por dentro",
      "Quer ver com os seus olhos?",
    ])
    expect(html).toContain('id="conheca"')
    expect(html).toContain('href="/bastidores#mcp"')
  })
})

describe("ChamadaFinal", () => {
  const render = (p: { google: boolean; demosHoje: number }) =>
    renderToStaticMarkup(<ChamadaFinal estado={estado(p)} acaoDemo={acao} acaoGoogle={acao} />)

  it("com demonstração, mostra o botão da demonstração", () => {
    expect(render({ google: false, demosHoje: 0 })).toContain("Testar com perfil de demonstração")
  })

  it("sem demonstração e com Google, só Entrar com Google", () => {
    const html = render({ google: true, demosHoje: 10 })
    expect(html).toContain("Entrar com Google")
    expect(html).not.toContain("Testar com perfil")
  })

  it("sem os dois, só o texto do estado", () => {
    const html = render({ google: false, demosHoje: 10 })
    expect(html).not.toContain("<button")
    expect(html).not.toContain("<form")
    expect(html).toContain("hoje")
  })
})
