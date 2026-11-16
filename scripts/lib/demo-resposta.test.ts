import { describe, expect, it } from "vitest"
import type { PropostaNaSaida } from "@/core/proposals/conteudo"
import type { Pergunta } from "@/core/runs/pergunta"
import { aprovadasDoTexto, formatarBloco, formatarPergunta, respostaDoTexto } from "./demo-resposta"

const propostasDeExemplo: PropostaNaSaida[] = [
  { id: "p1", tool: "casa.propor", texto: "Você tem abóbora em casa" },
  { id: "p2", tool: "memoria.propor", texto: "Você gosta de couve" },
  {
    id: "p3",
    tool: "lista.propor",
    texto: 'Gengibre na lista "Para ter em casa" (faltou para hoje)',
  },
]

const perguntaDeCasa: Pergunta = {
  tipo: "casa",
  texto: "Ainda tem abóbora e couve?",
  itens: [
    { alimento_id: "abobora", nome: "Abóbora" },
    { alimento_id: "couve", nome: "Couve" },
  ],
}

const perguntaDeCome: Pergunta = {
  tipo: "come",
  texto: "Você come ovo?",
  alimento_id: "ovo",
  nome: "Ovo",
}

const perguntaDeVariante: Pergunta = {
  tipo: "variante",
  texto: "Como é a dor de cabeça?",
  incomodo: "dor-de-cabeca",
  opcoes: [
    { id: "latejante", texto: "Latejante" },
    { id: "pressao", texto: "Pressão na testa" },
  ],
}

describe("formatarPergunta", () => {
  it("põe o texto e, por item de casa, a linha numerada com as quatro opções", () => {
    expect(formatarPergunta(perguntaDeCasa)).toBe(
      [
        "Ainda tem abóbora e couve?",
        "  1. Abóbora  [t] Tenho  [n] Não tenho  [g] Não gosto  [Enter] Pular",
        "  2. Couve  [t] Tenho  [n] Não tenho  [g] Não gosto  [Enter] Pular",
      ].join("\n"),
    )
  })

  it("mostra Como e Não como numerados na pergunta de come", () => {
    expect(formatarPergunta(perguntaDeCome)).toBe(
      ["Você come ovo?", "  1. Como  2. Não como  [Enter] Pular"].join("\n"),
    )
  })

  it("numera as opções da variante e termina com Pular", () => {
    expect(formatarPergunta(perguntaDeVariante)).toBe(
      [
        "Como é a dor de cabeça?",
        "  1. Latejante",
        "  2. Pressão na testa",
        "  [Enter] Pular",
      ].join("\n"),
    )
  })
})

describe("respostaDoTexto · casa", () => {
  it("lê uma linha por item: t é tenho e n é não tenho", () => {
    expect(respostaDoTexto(perguntaDeCasa, ["t", "n"])).toEqual({
      tipo: "casa",
      itens: [
        { alimento_id: "abobora", resposta: "tenho" },
        { alimento_id: "couve", resposta: "nao_tenho" },
      ],
    })
  })

  it("aceita maiúscula e g é não gosto", () => {
    expect(respostaDoTexto(perguntaDeCasa, ["T", "G"])).toEqual({
      tipo: "casa",
      itens: [
        { alimento_id: "abobora", resposta: "tenho" },
        { alimento_id: "couve", resposta: "nao_gosto" },
      ],
    })
  })

  it("linha vazia pula o item, que fica fora da lista", () => {
    expect(respostaDoTexto(perguntaDeCasa, ["", "n"])).toEqual({
      tipo: "casa",
      itens: [{ alimento_id: "couve", resposta: "nao_tenho" }],
    })
  })

  it("outra letra também pula o item", () => {
    expect(respostaDoTexto(perguntaDeCasa, ["x", "t"])).toEqual({
      tipo: "casa",
      itens: [{ alimento_id: "couve", resposta: "tenho" }],
    })
  })

  it("sem nenhuma linha, a resposta de casa vem vazia", () => {
    expect(respostaDoTexto(perguntaDeCasa, [])).toEqual({ tipo: "casa", itens: [] })
  })
})

describe("respostaDoTexto · come e variante", () => {
  it("1 é como e 2 é não como", () => {
    expect(respostaDoTexto(perguntaDeCome, ["1"])).toEqual({ tipo: "come", resposta: "como" })
    expect(respostaDoTexto(perguntaDeCome, ["2"])).toEqual({ tipo: "come", resposta: "nao_como" })
  })

  it("vazio ou fora da faixa vira pular no come", () => {
    expect(respostaDoTexto(perguntaDeCome, [""])).toEqual({ tipo: "pular" })
    expect(respostaDoTexto(perguntaDeCome, ["9"])).toEqual({ tipo: "pular" })
  })

  it("o número escolhe a opção da variante pelo id", () => {
    expect(respostaDoTexto(perguntaDeVariante, ["2"])).toEqual({
      tipo: "variante",
      variante: "pressao",
    })
  })

  it("variante vazia, zero ou fora da faixa vira pular", () => {
    expect(respostaDoTexto(perguntaDeVariante, [""])).toEqual({ tipo: "pular" })
    expect(respostaDoTexto(perguntaDeVariante, ["0"])).toEqual({ tipo: "pular" })
    expect(respostaDoTexto(perguntaDeVariante, ["3"])).toEqual({ tipo: "pular" })
  })
})

describe("formatarBloco", () => {
  it("põe o cabeçalho, uma linha marcada por proposta e os dois botões", () => {
    expect(formatarBloco(propostasDeExemplo.slice(0, 2))).toBe(
      [
        "Posso anotar isto?",
        "  1. [x] Você tem abóbora em casa",
        "  2. [x] Você gosta de couve",
        "[Agora não] [Anotar]",
      ].join("\n"),
    )
  })
})

describe("aprovadasDoTexto", () => {
  it("linha vazia anota tudo", () => {
    expect(aprovadasDoTexto(propostasDeExemplo, "")).toEqual(["p1", "p2", "p3"])
  })

  it("um número desliga essa linha", () => {
    expect(aprovadasDoTexto(propostasDeExemplo, "2")).toEqual(["p1", "p3"])
  })

  it("números separados por vírgula desligam essas linhas", () => {
    expect(aprovadasDoTexto(propostasDeExemplo, "1, 3")).toEqual(["p2"])
  })

  it("n ou N é Agora não: nada é aprovado", () => {
    expect(aprovadasDoTexto(propostasDeExemplo, "n")).toEqual([])
    expect(aprovadasDoTexto(propostasDeExemplo, "N")).toEqual([])
  })

  it("número fora da faixa é ignorado: não desliga linha nenhuma", () => {
    expect(aprovadasDoTexto(propostasDeExemplo, "9")).toEqual(["p1", "p2", "p3"])
    expect(aprovadasDoTexto(propostasDeExemplo, "0, 2")).toEqual(["p1", "p3"])
  })
})
