import { describe, expect, it } from "vitest"
import {
  type ConteudoDaProposta,
  conteudoDaPropostaSchema,
  lerConteudo,
  propostaNaSaidaSchema,
  semTool,
} from "@/core/proposals/conteudo"

const validas: ConteudoDaProposta[] = [
  {
    tool: "casa.propor",
    acao: "tem",
    itens: [{ nome: "abóbora" }, { alimento_id: "couve", nome: "couve" }],
  },
  { tool: "casa.propor", acao: "acabou", itens: [{ alimento_id: "arroz-branco", nome: "arroz" }] },
  { tool: "memoria.propor", tipo: "evitar_sempre", itens: [{ tipo: "grupo", valor: "carnes" }] },
  { tool: "memoria.propor", tipo: "restricao", itens: ["sem_gluten"] },
  { tool: "memoria.propor", tipo: "nao_come", itens: [{ nome: "jiló" }] },
  { tool: "memoria.propor", tipo: "gosta", itens: [{ alimento_id: "abobora", nome: "abóbora" }] },
  { tool: "memoria.propor", tipo: "rotina", texto: "essa semana você almoça fora" },
  {
    tool: "lista.propor",
    alimento_id: "gengibre",
    motivo: "faltou_hoje",
    detalhe: "chá de gengibre com canela",
  },
]

describe("conteudoDaPropostaSchema", () => {
  it.each(validas.map((c) => [c.tool, c]))("aceita a variante %s", (_nome, c) => {
    expect(conteudoDaPropostaSchema.safeParse(c).success).toBe(true)
  })

  it.each(validas.map((c) => [c.tool, c]))("recusa campo a mais em %s", (_nome, c) => {
    expect(conteudoDaPropostaSchema.safeParse({ ...c, extra: 1 }).success).toBe(false)
  })

  it("recusa tool desconhecida", () => {
    expect(
      conteudoDaPropostaSchema.safeParse({ tool: "memoria.remover", tipo: "rotina", texto: "x" })
        .success,
    ).toBe(false)
  })

  it("recusa itens vazio", () => {
    expect(
      conteudoDaPropostaSchema.safeParse({ tool: "casa.propor", acao: "tem", itens: [] }).success,
    ).toBe(false)
  })

  it("recusa rotina com 201 caracteres e aceita com 200", () => {
    const base = { tool: "memoria.propor", tipo: "rotina" }
    expect(conteudoDaPropostaSchema.safeParse({ ...base, texto: "a".repeat(201) }).success).toBe(
      false,
    )
    expect(conteudoDaPropostaSchema.safeParse({ ...base, texto: "a".repeat(200) }).success).toBe(
      true,
    )
  })

  it("recusa motivo fora da lista", () => {
    expect(
      conteudoDaPropostaSchema.safeParse({
        tool: "lista.propor",
        alimento_id: "gengibre",
        motivo: "acabou",
        detalhe: "x",
      }).success,
    ).toBe(false)
  })

  it("recusa restrição fora do vocabulário", () => {
    expect(
      conteudoDaPropostaSchema.safeParse({
        tool: "memoria.propor",
        tipo: "restricao",
        itens: ["sem_nada_disso"],
      }).success,
    ).toBe(false)
  })

  it("recusa ação de remoção", () => {
    expect(
      conteudoDaPropostaSchema.safeParse({
        tool: "casa.propor",
        acao: "remover",
        itens: [{ nome: "arroz" }],
      }).success,
    ).toBe(false)
  })

  it("recusa alimento_id e nome vazios", () => {
    expect(
      conteudoDaPropostaSchema.safeParse({
        tool: "casa.propor",
        acao: "tem",
        itens: [{ alimento_id: "", nome: "arroz" }],
      }).success,
    ).toBe(false)
    expect(
      conteudoDaPropostaSchema.safeParse({
        tool: "casa.propor",
        acao: "tem",
        itens: [{ nome: "" }],
      }).success,
    ).toBe(false)
  })
})

describe("semTool e lerConteudo", () => {
  it.each(validas.map((c) => [c.tool, c]))("ida e volta de %s", (_nome, c) => {
    const { tool, conteudo } = semTool(c)
    expect(tool).toBe(c.tool)
    expect(conteudo).not.toHaveProperty("tool")
    expect(lerConteudo(tool, conteudo)).toEqual(c)
  })

  it("lerConteudo com conteúdo inválido devolve undefined", () => {
    expect(lerConteudo("casa.propor", { acao: "tem", itens: [] })).toBeUndefined()
    expect(lerConteudo("tool.nova", { texto: "x" })).toBeUndefined()
    expect(lerConteudo("memoria.propor", null)).toBeUndefined()
  })
})

describe("propostaNaSaidaSchema", () => {
  it("aceita id, tool e texto", () => {
    expect(
      propostaNaSaidaSchema.safeParse({
        id: "p1",
        tool: "casa.propor",
        texto: "Você tem arroz em casa",
      }).success,
    ).toBe(true)
  })
})

describe("padrao.confirmar", () => {
  const padrao: ConteudoDaProposta = {
    tool: "padrao.confirmar",
    padrao_id: "padrao-1",
    frase: "Quando você está pesada, costuma estar também sem energia.",
  }

  it("passa no schema e volta igual por semTool e lerConteudo", () => {
    expect(conteudoDaPropostaSchema.safeParse(padrao).success).toBe(true)
    const { tool, conteudo } = semTool(padrao)
    expect(tool).toBe("padrao.confirmar")
    expect(lerConteudo(tool, conteudo)).toEqual(padrao)
  })

  it("recusa frase de 201 caracteres e aceita a de 200", () => {
    expect(conteudoDaPropostaSchema.safeParse({ ...padrao, frase: "a".repeat(201) }).success).toBe(
      false,
    )
    expect(conteudoDaPropostaSchema.safeParse({ ...padrao, frase: "a".repeat(200) }).success).toBe(
      true,
    )
  })

  it("recusa padrao_id vazio e campo a mais", () => {
    expect(conteudoDaPropostaSchema.safeParse({ ...padrao, padrao_id: "" }).success).toBe(false)
    expect(conteudoDaPropostaSchema.safeParse({ ...padrao, extra: 1 }).success).toBe(false)
  })

  it("propostaNaSaidaSchema aceita a tool padrao.confirmar", () => {
    expect(
      propostaNaSaidaSchema.safeParse({ id: "x", tool: "padrao.confirmar", texto: "t" }).success,
    ).toBe(true)
  })
})
