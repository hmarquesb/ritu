import { config, exemploDaLanding, textosLanding, textosSobre } from "@config/index"
import { textosAlertas } from "@config/textos-alertas"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ConversaDeExemplo, sugestoesDoExemplo } from "@/components/ritu/landing/exemplo"
import { Politica } from "@/components/ritu/sobre/politica"
import { textosDaConversa } from "@/core/conversation/textos"
import { contatoDePrivacidade } from "@/core/publico/contato"
import { prazosDaPolitica, preencher } from "@/core/publico/prazos"
import { getContainer } from "@/infra/container"

// Política de privacidade e conversa de exemplo da landing (spec 024): os marcadores têm valor, os prazos vêm
// da configuração, os textos de alerta são os do agente, sem `mailto:` sem contato e com os nomes da base.

const kb = getContainer().knowledge

// Marcadores que a Politica preenche (os prazos, o nome, a idade mínima e o e-mail, que ela troca por link).
const MARCADORES = [
  "mensagensDias",
  "faltasDias",
  "retornosDias",
  "demonstracaoHoras",
  "sessaoDias",
  "temaDias",
  "nome",
  "idadeMinima",
  "email",
]

const MARCADOR = /\{([A-Za-z0-9_.]+)\}/g

// Todo texto do Sobre, em qualquer profundidade (strings e listas).
function textosDoSobre(valor: unknown): string[] {
  if (typeof valor === "string") return [valor]
  if (Array.isArray(valor)) return valor.flatMap(textosDoSobre)
  if (valor && typeof valor === "object") return Object.values(valor).flatMap(textosDoSobre)
  return []
}

function politicaHtml(contato: string | null): string {
  return renderToStaticMarkup(
    createElement(Politica, { contato, prazos: prazosDaPolitica(), preencher }),
  )
}

describe("marcadores dos textos do Sobre", () => {
  it("todo marcador {chave} do Sobre tem valor e nenhum sobra no HTML", () => {
    for (const texto of textosDoSobre(textosSobre)) {
      for (const [, chave] of texto.matchAll(MARCADOR)) {
        expect(MARCADORES, `marcador {${chave}} sem valor em "${texto}"`).toContain(chave)
      }
    }
    for (const contato of [null, "contato@exemplo.test"]) {
      expect(politicaHtml(contato)).not.toMatch(/\{[A-Za-z0-9_.]+\}/)
    }
  })
})

describe("prazos da política", () => {
  it("vêm da configuração e aparecem no texto", () => {
    const prazos = prazosDaPolitica()
    expect(prazos).toEqual({
      mensagensDias: config.memoria.mensagensDias,
      faltasDias: config.memoria.faltasDias,
      retornosDias: config.memoria.retornosDias,
      demonstracaoHoras: config.limites.demo.duracaoHoras,
      sessaoDias: config.limites.sessao.dias,
      temaDias: config.ui.theme.maxAgeDays,
    })
    const html = politicaHtml(null)
    expect(html).toContain(`por ${prazos.mensagensDias} dias`)
    expect(html).toContain(`por ${prazos.faltasDias} dias`)
    expect(html).toContain(`em ${prazos.retornosDias} dias`)
    expect(html).toContain(`em ${prazos.demonstracaoHoras} horas`)
    expect(html).toContain(`até ${prazos.sessaoDias} dias`)
    expect(html).toContain(`por ${prazos.temaDias} dias`)
  })
})

describe("textos de alerta", () => {
  it("o alerta e o emocional do Sobre são os mesmos do agente", () => {
    expect(textosSobre.cuidados.alerta).toBe(textosDaConversa.alertaFisico)
    expect(textosSobre.cuidados.emocional).toBe(textosDaConversa.alertaEmocional)
    expect(textosSobre.cuidados.alerta).toBe(textosAlertas.fisico)
    expect(textosSobre.cuidados.emocional).toBe(textosAlertas.emocional)
  })
})

describe("contato sem variável", () => {
  it("sem contato, a política não tem mailto:", () => {
    expect(politicaHtml(null)).not.toContain("mailto:")
    expect(contatoDePrivacidade(undefined)).toBeNull()
    expect(contatoDePrivacidade("")).toBeNull()
  })

  it("com contato, o e-mail vira mailto:", () => {
    expect(politicaHtml("contato@exemplo.test")).toContain('href="mailto:contato@exemplo.test"')
  })
})

describe("conversa de exemplo", () => {
  const agente = textosLanding.exemplo.agente.toLocaleLowerCase("pt-BR")

  it("tem três sugestões da base e cada nome aparece no texto do agente", () => {
    expect(sugestoesDoExemplo(kb)).toHaveLength(3)
    for (const ref of exemploDaLanding.sugestoes) {
      const item = ref.tipo === "pratica" ? kb.pratica(ref.id) : kb.preparo(ref.id)
      expect(item, ref.id).toBeDefined()
      expect(agente, ref.id).toContain((item?.nome ?? "").toLocaleLowerCase("pt-BR"))
    }
  })

  it("renderiza o aviso e nenhum link", () => {
    const html = renderToStaticMarkup(createElement(ConversaDeExemplo, { kb }))
    expect(html).toContain(textosLanding.exemplo.aviso)
    expect(html).not.toContain("<a ")
  })
})
