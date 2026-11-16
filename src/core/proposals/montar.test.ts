import { describe, expect, it } from "vitest"
import type { Anotacao } from "@/core/proposals/anotacao"
import type { ConteudoDaProposta } from "@/core/proposals/conteudo"
import type { MensagemDoLoop } from "@/core/runs/agent-runtime"
import { montarPropostas, propostaDoParaTer, propostasDoAgente } from "./montar"

const rotina = (texto: string): ConteudoDaProposta => ({
  tool: "memoria.propor",
  tipo: "rotina",
  texto,
})

const lista = (alimento_id: string): ConteudoDaProposta => ({
  tool: "lista.propor",
  alimento_id,
  motivo: "faltou_hoje",
  detalhe: `${alimento_id} de hoje`,
})

const aceita = (proposta: ConteudoDaProposta): MensagemDoLoop => ({
  papel: "tool",
  chamada_id: `c-${proposta.tool}`,
  nome: proposta.tool,
  resultado: { proposto: true, proposta },
})

const recusada = (nome: string): MensagemDoLoop => ({
  papel: "tool",
  chamada_id: `r-${nome}`,
  nome,
  resultado: { proposto: false },
})

const casaTem = (...nomes: string[]): Anotacao => ({
  tipo: "casa_tem",
  itens: nomes.map((nome) => ({ nome })),
})

const casaAcabou = (nome: string): Anotacao => ({
  tipo: "casa_acabou",
  itens: [{ nome }],
})

describe("propostasDoAgente", () => {
  it("devolve as aceitas na ordem e ignora a recusada", () => {
    const mensagens: MensagemDoLoop[] = [
      aceita(rotina("Almoço fora às terças")),
      recusada("memoria.propor"),
      aceita(lista("gengibre")),
    ]
    expect(propostasDoAgente(mensagens)).toEqual([
      rotina("Almoço fora às terças"),
      lista("gengibre"),
    ])
  })

  it("rotina com o mesmo texto, sem acento e sem caixa, entra uma vez", () => {
    const mensagens: MensagemDoLoop[] = [
      aceita(rotina("Almoço fora às terças")),
      aceita(rotina("almoco fora as tercas")),
    ]
    expect(propostasDoAgente(mensagens)).toEqual([rotina("Almoço fora às terças")])
  })

  it("de lista.propor, só a primeira", () => {
    const mensagens: MensagemDoLoop[] = [aceita(lista("gengibre")), aceita(lista("couve"))]
    expect(propostasDoAgente(mensagens)).toEqual([lista("gengibre")])
  })

  it("resultado malformado é ignorado", () => {
    const mensagens: MensagemDoLoop[] = [
      {
        papel: "tool",
        chamada_id: "a",
        nome: "memoria.propor",
        resultado: { proposto: true },
      },
      {
        papel: "tool",
        chamada_id: "b",
        nome: "memoria.propor",
        resultado: "lixo",
      },
      aceita(rotina("ok")),
    ]
    expect(propostasDoAgente(mensagens)).toEqual([rotina("ok")])
  })

  it("ignora outras tools e mensagens que não são resultado de tool", () => {
    const mensagens: MensagemDoLoop[] = [
      { papel: "pessoa", conteudo: "oi" },
      {
        papel: "tool",
        chamada_id: "c",
        nome: "casa.propor",
        resultado: {
          proposto: true,
          proposta: { tool: "casa.propor", acao: "tem", itens: [{ nome: "arroz" }] },
        },
      },
    ]
    expect(propostasDoAgente(mensagens)).toEqual([])
  })
})

describe("propostaDoParaTer", () => {
  it("com para_ter, uma linha lista.propor com fez_falta e o número de vezes", () => {
    expect(propostaDoParaTer({ para_ter: { alimento_id: "mel", vezes: 3 } })).toEqual([
      { tool: "lista.propor", alimento_id: "mel", motivo: "fez_falta", detalhe: "3" },
    ])
  })

  it("sem para_ter, nenhuma linha", () => {
    expect(propostaDoParaTer({})).toEqual([])
  })

  it("a linha do para_ter fica na posição de lista, antes da rotina", () => {
    const extras = propostaDoParaTer({ para_ter: { alimento_id: "mel", vezes: 2 } })
    expect(
      montarPropostas({
        anotacoes: [casaTem("couve")],
        doAgente: [rotina("Almoço fora às terças")],
        extras,
      }),
    ).toEqual([
      { tool: "casa.propor", acao: "tem", itens: [{ nome: "couve" }] },
      { tool: "lista.propor", alimento_id: "mel", motivo: "fez_falta", detalhe: "2" },
      rotina("Almoço fora às terças"),
    ])
  })
})

describe("montarPropostas", () => {
  it("um assunto com três itens vira uma proposta só, com os três", () => {
    expect(
      montarPropostas({
        anotacoes: [casaTem("abóbora", "couve", "arroz")],
        doAgente: [],
      }),
    ).toEqual([
      {
        tool: "casa.propor",
        acao: "tem",
        itens: [{ nome: "abóbora" }, { nome: "couve" }, { nome: "arroz" }],
      },
    ])
  })

  it("ordem: evitar sempre, restrição, não como, gosta, casa tem, casa acabou", () => {
    const anotacoes: Anotacao[] = [
      casaAcabou("arroz"),
      { tipo: "gosta", itens: [{ alimento_id: "abobora", nome: "abóbora" }] },
      casaTem("couve"),
      { tipo: "nao_come", itens: [{ nome: "jiló" }] },
      { tipo: "restricao", itens: ["sem_gluten"] },
      { tipo: "evitar_sempre", itens: [{ tipo: "grupo", valor: "carnes" }] },
    ]
    expect(montarPropostas({ anotacoes, doAgente: [] })).toEqual([
      {
        tool: "memoria.propor",
        tipo: "evitar_sempre",
        itens: [{ tipo: "grupo", valor: "carnes" }],
      },
      { tool: "memoria.propor", tipo: "restricao", itens: ["sem_gluten"] },
      { tool: "memoria.propor", tipo: "nao_come", itens: [{ nome: "jiló" }] },
      {
        tool: "memoria.propor",
        tipo: "gosta",
        itens: [{ alimento_id: "abobora", nome: "abóbora" }],
      },
      { tool: "casa.propor", acao: "tem", itens: [{ nome: "couve" }] },
      { tool: "casa.propor", acao: "acabou", itens: [{ nome: "arroz" }] },
    ])
  })

  it("lista e rotina vêm depois; extras entra na posição da lista", () => {
    const anotacoes: Anotacao[] = [casaAcabou("arroz"), casaTem("couve")]
    const doAgente: ConteudoDaProposta[] = [rotina("Almoço fora às terças"), lista("gengibre")]
    const extras: ConteudoDaProposta[] = [lista("cominho")]
    expect(montarPropostas({ anotacoes, doAgente, extras })).toEqual([
      { tool: "casa.propor", acao: "tem", itens: [{ nome: "couve" }] },
      { tool: "casa.propor", acao: "acabou", itens: [{ nome: "arroz" }] },
      lista("gengibre"),
      lista("cominho"),
      rotina("Almoço fora às terças"),
    ])
  })

  it("com mais de seis, ficam as seis primeiras pela ordem", () => {
    const anotacoes = ["a", "b", "c", "d", "e", "f", "g"].map((nome) => casaTem(nome))
    const propostas = montarPropostas({ anotacoes, doAgente: [rotina("x")] })
    expect(propostas).toHaveLength(6)
    expect(propostas.map((p) => (p.tool === "casa.propor" ? p.itens[0]?.nome : p.tool))).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
    ])
  })

  it("anotação sem itens não vira linha", () => {
    expect(
      montarPropostas({
        anotacoes: [{ tipo: "casa_tem", itens: [] }, casaTem("arroz")],
        doAgente: [],
      }),
    ).toEqual([{ tool: "casa.propor", acao: "tem", itens: [{ nome: "arroz" }] }])
  })
})
