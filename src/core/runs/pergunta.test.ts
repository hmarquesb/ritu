import { describe, expect, it } from "vitest"
import { RituError } from "@/core/errors"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { MomentoQualidades } from "@/core/knowledge/momento"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import {
  montarPergunta,
  type Pergunta,
  perguntaDaVariante,
  perguntaSchema,
  type RespostaDaPessoa,
  respostaDaPessoaSchema,
  textoDaResposta,
  validarResposta,
} from "./pergunta"
import { ROTULOS_DA_RESPOSTA, TEXTOS_DA_PERGUNTA } from "./pergunta-textos"

const kb = createMiniKnowledge()

// A mini-base não tem ovo nem pão: a fixture acrescenta cada um com a forma de outro alimento.
function comAlimento(id: string, nome: string): KnowledgeBase {
  const modelo = kb.alimento("mel")
  if (!modelo) throw new Error("fixture: falta mel na mini-base")
  return { ...kb, alimento: (x) => (x === id ? { ...modelo, id, nome } : kb.alimento(x)) }
}

const kbComOvo = comAlimento("ovo", "Ovo")

const perguntaCasa: Pergunta = {
  tipo: "casa",
  texto: "Ainda tem abóbora e cenoura?",
  itens: [
    { alimento_id: "abobora", nome: "Abóbora" },
    { alimento_id: "cenoura", nome: "Cenoura" },
  ],
}

const perguntaCome: Pergunta = {
  tipo: "come",
  texto: "Você come ovo?",
  alimento_id: "ovo",
  nome: "Ovo",
}

const perguntaVariante: Pergunta = {
  tipo: "variante",
  texto: "A dor é latejante, tensa ou pesada?",
  incomodo: "dor_de_cabeca",
  opcoes: [
    { id: "latejante", texto: "Latejante" },
    { id: "tensa", texto: "Tensa" },
  ],
}

describe("textos fixos", () => {
  it("tem os textos e os rótulos exatos", () => {
    expect(TEXTOS_DA_PERGUNTA).toEqual({
      casaAindaTem: "Ainda tem {itens}?",
      casaVoceTem: "Você tem {itens} em casa?",
      come: "Você come {item}?",
    })
    expect(ROTULOS_DA_RESPOSTA).toEqual({
      tenho: "Tenho",
      nao_tenho: "Não tenho",
      nao_gosto: "Não gosto",
      como: "Como",
      nao_como: "Não como",
      pular: "Pular",
    })
  })
})

describe("schemas", () => {
  it("aceitam cada tipo de pergunta e recusam tipo desconhecido", () => {
    expect(perguntaSchema.safeParse(perguntaCasa).success).toBe(true)
    expect(perguntaSchema.safeParse(perguntaCome).success).toBe(true)
    expect(perguntaSchema.safeParse(perguntaVariante).success).toBe(true)
    expect(perguntaSchema.safeParse({ tipo: "outra", texto: "x" }).success).toBe(false)
    expect(perguntaSchema.safeParse({ ...perguntaCome, alimento_id: undefined }).success).toBe(
      false,
    )
  })

  it("aceitam cada tipo de resposta e recusam resposta fora do conjunto", () => {
    const casa = {
      tipo: "casa",
      itens: [
        { alimento_id: "abobora", resposta: "tenho" },
        { alimento_id: "cenoura", resposta: "nao_gosto" },
      ],
    }
    expect(respostaDaPessoaSchema.safeParse(casa).success).toBe(true)
    expect(respostaDaPessoaSchema.safeParse({ tipo: "come", resposta: "como" }).success).toBe(true)
    expect(respostaDaPessoaSchema.safeParse({ tipo: "variante", variante: "tensa" }).success).toBe(
      true,
    )
    expect(respostaDaPessoaSchema.safeParse({ tipo: "pular" }).success).toBe(true)
    expect(respostaDaPessoaSchema.safeParse({ tipo: "come", resposta: "pulou" }).success).toBe(
      false,
    )
    expect(
      respostaDaPessoaSchema.safeParse({
        tipo: "casa",
        itens: [{ alimento_id: "abobora", resposta: "pulou" }],
      }).success,
    ).toBe(false)
  })
})

describe("validarResposta", () => {
  it("aceita pular para os três tipos de pergunta", () => {
    const pular: RespostaDaPessoa = { tipo: "pular" }
    expect(validarResposta(perguntaCasa, pular)).toBe(true)
    expect(validarResposta(perguntaCome, pular)).toBe(true)
    expect(validarResposta(perguntaVariante, pular)).toBe(true)
  })

  it("aceita uma resposta de casa com os ids da pergunta", () => {
    const resposta: RespostaDaPessoa = {
      tipo: "casa",
      itens: [{ alimento_id: "cenoura", resposta: "tenho" }],
    }
    expect(validarResposta(perguntaCasa, resposta)).toBe(true)
  })

  it("recusa tipo trocado", () => {
    expect(validarResposta(perguntaCasa, { tipo: "come", resposta: "como" })).toBe(false)
    expect(validarResposta(perguntaCome, { tipo: "variante", variante: "tensa" })).toBe(false)
  })

  it("recusa alimento fora da pergunta e alimento repetido", () => {
    const fora: RespostaDaPessoa = {
      tipo: "casa",
      itens: [{ alimento_id: "ovo", resposta: "tenho" }],
    }
    const repetido: RespostaDaPessoa = {
      tipo: "casa",
      itens: [
        { alimento_id: "abobora", resposta: "tenho" },
        { alimento_id: "abobora", resposta: "nao_tenho" },
      ],
    }
    expect(validarResposta(perguntaCasa, fora)).toBe(false)
    expect(validarResposta(perguntaCasa, repetido)).toBe(false)
  })

  it("recusa variante inexistente e aceita variante das opções", () => {
    expect(validarResposta(perguntaVariante, { tipo: "variante", variante: "tensa" })).toBe(true)
    expect(validarResposta(perguntaVariante, { tipo: "variante", variante: "queimando" })).toBe(
      false,
    )
  })
})

describe("montarPergunta", () => {
  it("casa com dois incertos pergunta 'Ainda tem'", () => {
    const pergunta = montarPergunta(
      { tipo: "casa", alimentos: ["abobora", "cenoura"], incertos: ["abobora", "cenoura"] },
      kb,
    )
    expect(pergunta).toEqual({
      tipo: "casa",
      texto: "Ainda tem abóbora e cenoura?",
      itens: [
        { alimento_id: "abobora", nome: "Abóbora" },
        { alimento_id: "cenoura", nome: "Cenoura" },
      ],
    })
  })

  it("casa com um alimento nunca registrado pergunta 'Você tem … em casa'", () => {
    const pergunta = montarPergunta(
      { tipo: "casa", alimentos: ["abobora", "cenoura"], incertos: ["abobora"] },
      kb,
    )
    expect(pergunta.texto).toBe("Você tem abóbora e cenoura em casa?")
  })

  it("casa com três itens junta com vírgula e 'e'", () => {
    const pergunta = montarPergunta(
      {
        tipo: "casa",
        alimentos: ["abobora", "cenoura", "ovo"],
        incertos: ["abobora", "cenoura", "ovo"],
      },
      kbComOvo,
    )
    expect(pergunta.texto).toBe("Ainda tem abóbora, cenoura e ovo?")
  })

  it("come pergunta 'Você come …' com o nome em minúsculas", () => {
    const pergunta = montarPergunta({ tipo: "come", alimento: "ovo" }, kbComOvo)
    expect(pergunta).toEqual({
      tipo: "come",
      texto: "Você come ovo?",
      alimento_id: "ovo",
      nome: "Ovo",
    })
  })

  it("id fora da base lança fora_da_base", () => {
    expect(() => montarPergunta({ tipo: "come", alimento: "nao-existe" }, kb)).toThrow(RituError)
    try {
      montarPergunta({ tipo: "come", alimento: "nao-existe" }, kb)
    } catch (erro) {
      expect((erro as RituError).code).toBe("fora_da_base")
    }
  })

  it("não reinterpreta '$&' no nome do alimento", () => {
    const base = comAlimento("pao", "Pão $& queijo")
    const pergunta = montarPergunta({ tipo: "casa", alimentos: ["pao"], incertos: ["pao"] }, base)
    expect(pergunta.texto).toBe("Ainda tem pão $& queijo?")
  })
})

describe("perguntaDaVariante", () => {
  it("copia pergunta e opções do momento", () => {
    const precisa: NonNullable<MomentoQualidades["precisa_variante"]> = {
      incomodo: "dor_de_cabeca",
      pergunta: "A dor é latejante, tensa ou pesada?",
      opcoes: [
        { id: "latejante", texto: "Latejante" },
        { id: "tensa", texto: "Tensa" },
      ],
    }
    expect(perguntaDaVariante(precisa)).toEqual({
      tipo: "variante",
      texto: "A dor é latejante, tensa ou pesada?",
      incomodo: "dor_de_cabeca",
      opcoes: [
        { id: "latejante", texto: "Latejante" },
        { id: "tensa", texto: "Tensa" },
      ],
    })
  })
})

describe("textoDaResposta", () => {
  it("casa agrupa Tenho, Não tenho e Não gosto, com nomes juntados", () => {
    const pergunta: Pergunta = {
      tipo: "casa",
      texto: "Ainda tem abóbora, cenoura e ovo?",
      itens: [
        { alimento_id: "abobora", nome: "Abóbora" },
        { alimento_id: "cenoura", nome: "Cenoura" },
        { alimento_id: "ovo", nome: "Ovo" },
      ],
    }
    const resposta: RespostaDaPessoa = {
      tipo: "casa",
      itens: [
        { alimento_id: "ovo", resposta: "nao_gosto" },
        { alimento_id: "cenoura", resposta: "nao_tenho" },
        { alimento_id: "abobora", resposta: "tenho" },
      ],
    }
    expect(textoDaResposta(pergunta, resposta)).toBe(
      "Tenho: abóbora · Não tenho: cenoura · Não gosto: ovo",
    )
  })

  it("grupos vazios não aparecem e dois itens no mesmo grupo se juntam", () => {
    const resposta: RespostaDaPessoa = {
      tipo: "casa",
      itens: [
        { alimento_id: "abobora", resposta: "tenho" },
        { alimento_id: "cenoura", resposta: "tenho" },
      ],
    }
    expect(textoDaResposta(perguntaCasa, resposta)).toBe("Tenho: abóbora e cenoura")
  })

  it("casa só com pulados vira 'Pular'", () => {
    expect(textoDaResposta(perguntaCasa, { tipo: "casa", itens: [] })).toBe("Pular")
  })

  it("come vira 'Como' ou 'Não como'", () => {
    expect(textoDaResposta(perguntaCome, { tipo: "come", resposta: "como" })).toBe("Como")
    expect(textoDaResposta(perguntaCome, { tipo: "come", resposta: "nao_como" })).toBe("Não como")
  })

  it("variante vira o texto da opção escolhida", () => {
    expect(textoDaResposta(perguntaVariante, { tipo: "variante", variante: "tensa" })).toBe("Tensa")
  })

  it("pular vira 'Pular'", () => {
    expect(textoDaResposta(perguntaVariante, { tipo: "pular" })).toBe("Pular")
  })

  it("não reinterpreta '$&' no nome do alimento", () => {
    const pergunta: Pergunta = {
      tipo: "casa",
      texto: "Você tem pão $& queijo em casa?",
      itens: [{ alimento_id: "pao", nome: "Pão $& queijo" }],
    }
    const resposta: RespostaDaPessoa = {
      tipo: "casa",
      itens: [{ alimento_id: "pao", resposta: "tenho" }],
    }
    expect(textoDaResposta(pergunta, resposta)).toBe("Tenho: pão $& queijo")
  })
})
