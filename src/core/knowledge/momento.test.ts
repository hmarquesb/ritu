import { describe, expect, it } from "vitest"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { momentoDoDia, qualidadesDoMomento } from "./momento"
import { ESTADOS } from "./vocab"

const kb = createMiniKnowledge()

describe("qualidadesDoMomento", () => {
  it.each(ESTADOS)("estado %s devolve presentes e buscadas iguais à linha de estados", (id) => {
    const linha = kb.estados.find((e) => e.id === id)
    expect(linha).toBeDefined()

    const r = qualidadesDoMomento({ estados: [id] }, kb)

    expect(r.presentes).toEqual(linha?.presentes)
    expect(r.buscadas).toEqual(linha?.favorecer)
    expect(r.linhas_base).toEqual([`estados:${id}`])
  })

  it("com_calor + pesada devolve o conflito frio/quente e mantém as duas em buscadas", () => {
    const r = qualidadesDoMomento({ estados: ["com_calor", "pesada"] }, kb)

    expect(r.conflitos).toEqual([["frio", "quente"]])
    expect(r.buscadas).toContain("frio")
    expect(r.buscadas).toContain("quente")
  })

  it("dor de cabeça sem variante pede a variante com as 3 opções e sem qualidades do incômodo", () => {
    const r = qualidadesDoMomento({ estados: [], incomodo: { id: "dor-de-cabeca" } }, kb)

    expect(r.precisa_variante).toEqual({
      incomodo: "dor-de-cabeca",
      pergunta: "Como é a sua dor de cabeça?",
      opcoes: [
        { id: "latejante", texto: "Latejante, batendo" },
        { id: "tensa", texto: "Tensa, apertando" },
        { id: "pesada", texto: "Pesada, com peso na cabeça" },
      ],
    })
    expect(r.presentes).toEqual([])
    expect(r.buscadas).toEqual([])
  })

  it("dor de cabeça com variante latejante usa as qualidades da variante e a sua linha base", () => {
    const r = qualidadesDoMomento(
      { estados: [], incomodo: { id: "dor-de-cabeca", variante: "latejante" } },
      kb,
    )

    expect(r.precisa_variante).toBeUndefined()
    expect(r.presentes).toEqual(["quente", "intenso"])
    expect(r.buscadas).toEqual(["frio", "suave"])
    expect(r.linhas_base).toContain("incomodos:dor-de-cabeca/latejante")
    expect(r.evitar).toContainEqual({
      texto: "café e picantes",
      linha_base: "incomodos:dor-de-cabeca/latejante",
    })
  })

  it("incômodo com uma só variante usa 'unica' sem perguntar", () => {
    const r = qualidadesDoMomento({ estados: [], incomodo: { id: "gases" } }, kb)

    expect(r.precisa_variante).toBeUndefined()
    expect(r.presentes).toEqual(["frio", "seco"])
    expect(r.linhas_base).toEqual(["incomodos:gases/unica"])
  })

  it("variante informada que não existe leva à pergunta de novo", () => {
    const r = qualidadesDoMomento(
      { estados: [], incomodo: { id: "dor-de-cabeca", variante: "xyz" } },
      kb,
    )

    expect(r.precisa_variante?.incomodo).toBe("dor-de-cabeca")
    expect(r.presentes).toEqual([])
  })

  it("incômodo com id inexistente é ignorado", () => {
    const r = qualidadesDoMomento({ estados: [], incomodo: { id: "nao-existe" } }, kb)

    expect(r.precisa_variante).toBeUndefined()
    expect(r.presentes).toEqual([])
    expect(r.linhas_base).toEqual([])
  })

  it("entrada vazia devolve tudo vazio", () => {
    const r = qualidadesDoMomento({ estados: [] }, kb)

    expect(r).toEqual({
      presentes: [],
      buscadas: [],
      evitar_gunas: [],
      evitar_marcas: [],
      evitar: [],
      conflitos: [],
      linhas_base: [],
      precisa_variante: undefined,
    })
  })

  it("clima frio e oleoso entra em presentes e a oposta (quente, seco) em buscadas", () => {
    const r = qualidadesDoMomento({ estados: [], gunasDoClima: ["frio", "oleoso"] }, kb)

    expect(r.presentes).toEqual(["frio", "oleoso"])
    expect(r.buscadas).toEqual(["quente", "seco"])
  })
})

describe("momentoDoDia", () => {
  it.each([
    [0, "noite"],
    [4, "noite"],
    [5, "manha"],
    [10, "manha"],
    [11, "almoco"],
    [14, "almoco"],
    [15, "tarde"],
    [17, "tarde"],
    [18, "jantar"],
    [20, "jantar"],
    [21, "noite"],
    [23, "noite"],
  ] as const)("hora %i é %s", (hora, momento) => {
    expect(momentoDoDia(hora)).toBe(momento)
  })
})
