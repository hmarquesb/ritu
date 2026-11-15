import { describe, expect, it } from "vitest"
import { createKnowledgeBase, KnowledgeInvalidError } from "./knowledge-base"
import type { Alimento, DadosDaBase, Fonte, Incomodo } from "./schemas"
import { GUNAS } from "./vocab"

const refs = [{ ref: "fonte-a", campos: ["gunas"] }]
const fonte: Fonte = { ref: "fonte-a", titulo: "Fonte A", autor: "Autora", aprovada: true }
const semCobertura = { cobertura: false }

function alimento(sobrescrita: Partial<Alimento> = {}): Alimento {
  return {
    id: "abobora",
    nome: "Abóbora",
    sinonimos: [],
    grupo: "legumes",
    durabilidade: "media",
    funcoes: ["legume"],
    rasa: ["doce"],
    virya: "quente",
    vipaka: "doce",
    gunas: ["pesado", "oleoso"],
    efeito: { vata: -1, pitta: -1, kapha: 1 },
    como_equilibrar: {},
    restricoes: [],
    grupos_evitar: [],
    marcas: [],
    fontes: refs,
    confianca: "alta",
    notas: "",
    ...sobrescrita,
  }
}

const incomodo: Incomodo = {
  id: "dor-de-cabeca",
  nome: "Dor de cabeça",
  palavras: ["cabeça"],
  pergunta: "Como ela é?",
  variantes: [
    {
      id: "latejante",
      opcao: "Latejante",
      presentes: ["quente"],
      favorecer: ["frio"],
      evitar_gunas: ["quente"],
      evitar_marcas: [],
      evitar_texto: "picantes",
    },
    {
      id: "pressao",
      opcao: "Pressão",
      presentes: ["seco"],
      favorecer: ["oleoso"],
      evitar_gunas: ["seco"],
      evitar_marcas: [],
      evitar_texto: "secos",
    },
  ],
  fontes: refs,
  confianca: "baixa",
}

function base(): DadosDaBase {
  return {
    alimentos: [alimento(), alimento({ id: "gengibre", nome: "Gengibre", grupo: "especiarias" })],
    preparos: [],
    praticas: [],
    combinacoes: [],
    doshas: [],
    estados: [],
    incomodos: [incomodo],
    quiz: [],
    gruposEvitar: [],
    vocabulario: GUNAS.map((guna) => ({
      guna,
      nome: guna,
      verbo: guna === "quente" ? "aquece" : null,
    })),
    fontes: [fonte],
  }
}

function erroDe(executa: () => unknown): unknown {
  try {
    executa()
  } catch (erro) {
    return erro
  }
  return undefined
}

describe("createKnowledgeBase", () => {
  it("indexa alimentos, preparos e práticas por id", () => {
    const kb = createKnowledgeBase(base(), semCobertura)
    expect(kb.alimentos).toHaveLength(2)
    expect(kb.alimento("abobora")?.nome).toBe("Abóbora")
    expect(kb.alimento("nada")).toBeUndefined()
    expect(kb.preparo("nada")).toBeUndefined()
    expect(kb.pratica("nada")).toBeUndefined()
  })

  it("lança KnowledgeInvalidError com código base_invalida e a lista de erros", () => {
    const duplicada = { ...base(), alimentos: [alimento(), alimento()] }
    const erro = erroDe(() => createKnowledgeBase(duplicada, semCobertura))
    expect(erro).toBeInstanceOf(KnowledgeInvalidError)
    const invalida = erro as KnowledgeInvalidError
    expect(invalida.code).toBe("base_invalida")
    expect(invalida.erros).toContain("alimentos:abobora:id repetido")
    expect(invalida.message).toContain("inválida")
  })

  it("usa a cobertura por padrão e recusa uma base abaixo do mínimo", () => {
    const erro = erroDe(() => createKnowledgeBase(base()))
    expect(erro).toBeInstanceOf(KnowledgeInvalidError)
    expect((erro as KnowledgeInvalidError).erros).toContain(
      "cobertura: alimentos tem 2, mínimo 130",
    )
  })
})

describe("KnowledgeBase.linha", () => {
  const kb = createKnowledgeBase(base(), semCobertura)

  it("devolve a linha de uma tabela pelo id", () => {
    expect(kb.linha("alimentos:abobora")).toEqual(alimento())
    expect(kb.linha("fontes:fonte-a")).toEqual(fonte)
  })

  it("devolve a variante de um incômodo com id/variante, e o incômodo sem variante", () => {
    expect(kb.linha("incomodos:dor-de-cabeca/latejante")).toMatchObject({ opcao: "Latejante" })
    expect(kb.linha("incomodos:dor-de-cabeca")).toMatchObject({ nome: "Dor de cabeça" })
  })

  it("devolve undefined para tabela inexistente, id inexistente ou ref malformada", () => {
    expect(kb.linha("nada:x")).toBeUndefined()
    expect(kb.linha("alimentos:nada")).toBeUndefined()
    expect(kb.linha("malformado")).toBeUndefined()
  })
})

describe("KnowledgeBase.verbo", () => {
  const kb = createKnowledgeBase(base(), semCobertura)

  it("devolve o verbo da qualidade quando ele existe", () => {
    expect(kb.verbo("quente")).toBe("aquece")
  })

  it("devolve null quando a qualidade não tem verbo", () => {
    expect(kb.verbo("aspero")).toBeNull()
  })
})
