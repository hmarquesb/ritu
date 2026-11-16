import { describe, expect, it } from "vitest"
import type { ConteudoDaProposta } from "@/core/proposals/conteudo"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { textoDaProposta, textosDasPropostas } from "./textos"

const kb = createMiniKnowledge()

describe("textosDasPropostas", () => {
  it("traz cada texto fixo literal", () => {
    expect(textosDasPropostas).toEqual({
      casaTem: "Você tem {itens} em casa",
      casaAcabou: "Acabou: {itens}",
      evitarSempre: "Não sugerir mais {itens} (Evitar sempre)",
      restricao: "Sua alimentação é {itens}",
      naoCome: "Você não come {itens}",
      gosta: "Você gosta de {itens}",
      listaFaltouHoje: '{Item} na lista "Para ter em casa" (faltou para {detalhe})',
      listaFezFalta: '{Item} na lista "Para ter em casa" (já fez falta {detalhe} vezes)',
      cabecalho: "Posso anotar isto?",
      agoraNao: "Agora não",
      anotar: "Anotar",
      padrao: "Notei isto. Está certo? {frase}",
    })
  })
})

describe("textoDaProposta: casa", () => {
  it("lista o que a pessoa tem, com juntarNomes", () => {
    const c: ConteudoDaProposta = {
      tool: "casa.propor",
      acao: "tem",
      itens: [
        { alimento_id: "abobora", nome: "Abóbora" },
        { alimento_id: "cenoura", nome: "Cenoura" },
        { alimento_id: "arroz-branco", nome: "Arroz branco" },
      ],
    }
    expect(textoDaProposta(c, kb)).toBe("Você tem abóbora, cenoura e arroz branco em casa")
  })

  it("monta o texto de acabou", () => {
    const c: ConteudoDaProposta = {
      tool: "casa.propor",
      acao: "acabou",
      itens: [{ alimento_id: "limao", nome: "Limão" }],
    }
    expect(textoDaProposta(c, kb)).toBe("Acabou: limão")
  })
})

describe("textoDaProposta: memória", () => {
  it("evitar sempre de grupo usa o nome do grupo", () => {
    const c: ConteudoDaProposta = {
      tool: "memoria.propor",
      tipo: "evitar_sempre",
      itens: [{ tipo: "grupo", valor: "amendoim" }],
    }
    expect(textoDaProposta(c, kb)).toBe("Não sugerir mais amendoim (Evitar sempre)")
  })

  it("restrição usa o rótulo do vocabulário", () => {
    const c: ConteudoDaProposta = {
      tool: "memoria.propor",
      tipo: "restricao",
      itens: ["sem_gluten"],
    }
    expect(textoDaProposta(c, kb)).toBe("Sua alimentação é sem glúten")
  })

  it("não como com nome livre", () => {
    const c: ConteudoDaProposta = {
      tool: "memoria.propor",
      tipo: "nao_come",
      itens: [{ nome: "Pão de forma" }],
    }
    expect(textoDaProposta(c, kb)).toBe("Você não come pão de forma")
  })

  it("gosta usa o nome da base", () => {
    const c: ConteudoDaProposta = {
      tool: "memoria.propor",
      tipo: "gosta",
      itens: [{ alimento_id: "cardamomo", nome: "Cardamomo" }],
    }
    expect(textoDaProposta(c, kb)).toBe("Você gosta de cardamomo")
  })

  it("rotina com a primeira letra maiúscula e nada mais", () => {
    const c: ConteudoDaProposta = {
      tool: "memoria.propor",
      tipo: "rotina",
      texto: "essa semana você almoça fora",
    }
    expect(textoDaProposta(c, kb)).toBe("Essa semana você almoça fora")
  })
})

describe("textoDaProposta: lista", () => {
  it("faltou hoje usa o nome com inicial maiúscula e o detalhe com inicial minúscula", () => {
    const c: ConteudoDaProposta = {
      tool: "lista.propor",
      alimento_id: "gengibre",
      motivo: "faltou_hoje",
      detalhe: "Chá de gengibre com canela",
    }
    expect(textoDaProposta(c, kb)).toBe(
      'Gengibre na lista "Para ter em casa" (faltou para chá de gengibre com canela)',
    )
  })

  it("fez falta usa o número de vezes como está", () => {
    const c: ConteudoDaProposta = {
      tool: "lista.propor",
      alimento_id: "gengibre",
      motivo: "fez_falta",
      detalhe: "4",
    }
    expect(textoDaProposta(c, kb)).toBe(
      'Gengibre na lista "Para ter em casa" (já fez falta 4 vezes)',
    )
  })

  it("sem o alimento na base, usa o próprio id com inicial maiúscula", () => {
    const c: ConteudoDaProposta = {
      tool: "lista.propor",
      alimento_id: "nao-existe",
      motivo: "fez_falta",
      detalhe: "2",
    }
    expect(textoDaProposta(c, kb)).toBe(
      'Nao-existe na lista "Para ter em casa" (já fez falta 2 vezes)',
    )
  })
})

describe("textoDaProposta: troca segura", () => {
  it("um nome com $& e marcas de troca sai como texto", () => {
    const c: ConteudoDaProposta = {
      tool: "memoria.propor",
      tipo: "nao_come",
      itens: [{ nome: "Pão $& {detalhe}" }],
    }
    expect(textoDaProposta(c, kb)).toBe("Você não come pão $& {detalhe}")
  })
})

describe("textoDaProposta: padrão", () => {
  it("a linha é a pergunta com a frase do padrão", () => {
    const c: ConteudoDaProposta = {
      tool: "padrao.confirmar",
      padrao_id: "padrao-1",
      frase: "Quando você está pesada, costuma estar também sem energia.",
    }
    expect(textoDaProposta(c, kb)).toBe(
      "Notei isto. Está certo? Quando você está pesada, costuma estar também sem energia.",
    )
  })

  it("uma frase com $& e marcas de troca sai como texto", () => {
    const c: ConteudoDaProposta = {
      tool: "padrao.confirmar",
      padrao_id: "padrao-1",
      frase: "Use $& e {frase} aqui.",
    }
    expect(textoDaProposta(c, kb)).toBe("Notei isto. Está certo? Use $& e {frase} aqui.")
  })
})
