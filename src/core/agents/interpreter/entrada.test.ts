import { describe, expect, it } from "vitest"
import type { Retorno } from "@/core/outcomes/ports"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { montarEntradaDoInterprete } from "./entrada"

const kb = createMiniKnowledge()

function retorno(tipo: Retorno["sugestao"]["tipo"], titulo: string): Retorno {
  return {
    id: `ret-${titulo}`,
    conta_id: "conta-1",
    run_id: "run-1",
    sugestao: { tipo, titulo, alimentos: [] },
    status: "aguardando",
    resultado: null,
    origem: null,
    criado_em: "2026-11-15T10:00:00.000Z",
    respondido_em: null,
  }
}

function bloco(texto: string, nome: string): string {
  const abre = texto.indexOf(`<${nome}>`)
  const fecha = texto.indexOf(`</${nome}>`)
  return texto
    .slice(abre + nome.length + 2, fecha)
    .replace(/^\n/, "")
    .replace(/\n$/, "")
}

describe("montarEntradaDoInterprete", () => {
  it("monta os blocos na ordem da spec", () => {
    const texto = montarEntradaDoInterprete({
      texto: "estou com frio",
      atalhos: ["com_frio"],
      conversa: [{ autor: "pessoa", texto: "oi" }],
      pendentes: [retorno("cha", "Chá de gengibre")],
      kb,
    })
    const ordem = [
      "<estados>",
      "<incomodos>",
      "<restricoes>",
      "<pendentes>",
      "<conversa_do_dia>",
      "<atalhos>",
      "<mensagem_da_pessoa>",
    ].map((tag) => texto.indexOf(tag))
    expect(ordem.every((i) => i >= 0)).toBe(true)
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem)
  })

  it("lista estados e restrições com id e rótulo", () => {
    const texto = montarEntradaDoInterprete({
      texto: "x",
      atalhos: [],
      conversa: [],
      pendentes: [],
      kb,
    })
    expect(bloco(texto, "estados")).toContain("com_frio: com frio")
    expect(bloco(texto, "restricoes")).toBe(
      [
        "vegetariana: vegetariana",
        "vegana: vegana",
        "sem_lactose: sem lactose",
        "sem_gluten: sem glúten",
      ].join("\n"),
    )
  })

  it("mostra as variantes só quando não é a variante única", () => {
    const texto = montarEntradaDoInterprete({
      texto: "x",
      atalhos: [],
      conversa: [],
      pendentes: [],
      kb,
    })
    const incomodos = bloco(texto, "incomodos").split("\n")
    expect(incomodos).toContain(
      "dor-de-cabeca: dor de cabeça, cabeça latejando, cabeça pesada | variantes: latejante, tensa, pesada",
    )
    expect(incomodos).toContain("gases: gases, barriga cheia de gás, inchaço")
    expect(texto).not.toContain("variantes: unica")
  })

  it("numera os pendentes a partir de 1 com tipo e título", () => {
    const texto = montarEntradaDoInterprete({
      texto: "x",
      atalhos: [],
      conversa: [],
      pendentes: [retorno("cha", "Chá de gengibre"), retorno("refeicao", "Arroz com abóbora")],
      kb,
    })
    expect(bloco(texto, "pendentes")).toBe(
      "1. cha: Chá de gengibre\n2. refeicao: Arroz com abóbora",
    )
  })

  it("não põe os blocos vazios quando não há pendentes, conversa nem atalhos", () => {
    const texto = montarEntradaDoInterprete({
      texto: "x",
      atalhos: [],
      conversa: [],
      pendentes: [],
      kb,
    })
    expect(texto).not.toContain("<pendentes>")
    expect(texto).not.toContain("<conversa_do_dia>")
    expect(texto).not.toContain("<atalhos>")
    expect(texto).toContain("<mensagem_da_pessoa>\nx\n</mensagem_da_pessoa>")
  })

  it("não põe a mensagem quando o texto está vazio", () => {
    const texto = montarEntradaDoInterprete({
      texto: "",
      atalhos: ["agitada"],
      conversa: [],
      pendentes: [],
      kb,
    })
    expect(texto).not.toContain("<mensagem_da_pessoa>")
    expect(texto).toContain("<atalhos>agitada</atalhos>")
  })

  it("lista os atalhos separados por vírgula", () => {
    const texto = montarEntradaDoInterprete({
      texto: "",
      atalhos: ["com_frio", "agitada"],
      conversa: [],
      pendentes: [],
      kb,
    })
    expect(texto).toContain("<atalhos>com_frio, agitada</atalhos>")
  })

  it("troca < e > do texto da pessoa e da conversa por ‹ e ›", () => {
    const texto = montarEntradaDoInterprete({
      texto: "<b>oi</b>",
      atalhos: [],
      conversa: [{ autor: "pessoa", texto: "<i>antes</i>" }],
      pendentes: [],
      kb,
    })
    expect(bloco(texto, "mensagem_da_pessoa")).toBe("‹b›oi‹/b›")
    expect(bloco(texto, "conversa_do_dia")).toBe("pessoa: ‹i›antes‹/i›")
  })

  it("corta cada mensagem da conversa em 300 caracteres", () => {
    const longa = "a".repeat(400)
    const texto = montarEntradaDoInterprete({
      texto: "x",
      atalhos: [],
      conversa: [{ autor: "agente", texto: longa }],
      pendentes: [],
      kb,
    })
    expect(bloco(texto, "conversa_do_dia")).toBe(`agente: ${"a".repeat(300)}`)
  })
})
