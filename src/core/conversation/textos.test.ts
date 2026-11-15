import { describe, expect, it } from "vitest"
import type { Perfil } from "@/core/accounts/types"
import type {
  Interpretacao,
  ItemDeCasaCitado,
  RetornoCitado,
} from "@/core/agents/interpreter/interpretacao"
import { rotulosDeRestricao } from "@/core/knowledge/rotulos"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import {
  rotulosDeRestricao as reexportado,
  textoDeCasa,
  textoDeEvitar,
  textoDeRetorno,
  textosDaConversa,
} from "./textos"

const kb = createMiniKnowledge()

function perfil(parcial: Partial<Perfil> = {}): Perfil {
  return {
    conta_id: "conta-1",
    prakriti: null,
    origem: null,
    evitar_sempre: [],
    restricoes: [],
    nao_come: [],
    cidade_nome: null,
    cidade_lat: null,
    cidade_lon: null,
    cidade_fuso: null,
    atualizado_em: "2026-11-01T00:00:00.000Z",
    ...parcial,
  }
}

function interpretacao(parcial: Partial<Interpretacao> = {}): Interpretacao {
  return {
    intencoes: ["evitar"],
    estados: [],
    itens_casa: [],
    evitar: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
    ...parcial,
  }
}

describe("textosDaConversa", () => {
  it("traz cada texto fixo literal", () => {
    expect(textosDaConversa.fora).toBe(
      "Isso foge do que eu sei fazer. Eu ajudo com alimentação, rotina e Ayurveda: me conta como você está agora, ou pergunta sobre um alimento.",
    )
    expect(textosDaConversa.ofensa).toBe(
      "Tudo bem, tem dia que é assim. Se quiser, me conta como você está agora que eu tento ajudar.",
    )
    expect(textosDaConversa.ajuda).toBe(
      'Tudo o que eu guardo sobre você aparece em "O que sei sobre você", e lá dá para corrigir e apagar. Dosha, cidade, Evitar sempre e apagar seus dados ficam no Perfil. O que você tem em casa fica em Minha casa.',
    )
    expect(textosDaConversa.alertaFisico).toBe(
      "O que você descreveu pede o olhar de um profissional de saúde, e eu não devo sugerir nada para isso. Se for forte, repentino ou estiver piorando, procure um atendimento de urgência ou ligue 192.",
    )
    expect(textosDaConversa.alertaEmocional).toBe(
      "Sinto muito que você esteja passando por isso. Você não precisa enfrentar isso só. O CVV atende de graça, 24 horas, pelo telefone 188 ou pelo chat em cvv.org.br. Se você estiver em perigo agora, ligue 192.",
    )
    expect(textosDaConversa.casaTem).toBe(
      "Boa, {itens} em casa. Confirma abaixo que eu guardo em Minha casa.",
    )
    expect(textosDaConversa.casaAcabou).toBe(
      "Entendi, acabou {itens}. Confirma abaixo que eu atualizo Minha casa.",
    )
    expect(textosDaConversa.casaDesconhecido).toBe(
      "Ainda não conheço {itens}: guardo na sua casa, mas não uso em sugestões.",
    )
    expect(textosDaConversa.retornoAjudou).toBe(
      "Que bom que {titulo} ajudou. Anotei: vai aparecer mais vezes por aqui.",
    )
    expect(textosDaConversa.retornoNaoAjudou).toBe(
      "Anotei que {titulo} não ajudou desta vez. Se quiser, me conta como você está agora que eu penso em outra coisa.",
    )
    expect(textosDaConversa.retornoNaoFez).toBe("Tudo bem, anotei que você não fez {titulo}.")
    expect(textosDaConversa.retornoSemLigacao).toBe(
      'Não consegui achar de qual sugestão você está falando, então não anotei nada. Se quiser, marque em "Como ficou?".',
    )
    expect(textosDaConversa.evitar).toBe(
      "Entendi. A partir de agora não sugiro {itens}, nem nada que leve isso. Já vale para hoje; confirma abaixo para eu guardar em Evitar sempre.",
    )
    expect(textosDaConversa.evitarDesconhecido).toBe(
      "Ainda não conheço {itens}, mas vou levar isso em conta nas respostas.",
    )
    expect(textosDaConversa.evitarJaGuardado).toBe(
      "Isso já está em Evitar sempre: continuo sem sugerir {itens}.",
    )
    expect(textosDaConversa.naoCome).toBe(
      "Entendi, você não come {itens}. Já vale para hoje; confirma abaixo para eu guardar.",
    )
    expect(textosDaConversa.restricao).toBe(
      "Entendi: sua alimentação é {itens}. Já vale para hoje; confirma abaixo para eu guardar.",
    )
    expect(textosDaConversa.fixoJaGuardado).toBe("Isso eu já tinha guardado: {itens}.")
  })

  it("reexporta os rótulos das restrições", () => {
    expect(reexportado).toBe(rotulosDeRestricao)
  })
})

describe("textoDeCasa", () => {
  it("junta os itens que a pessoa tem, os que acabaram e os desconhecidos", () => {
    const itens: ItemDeCasaCitado[] = [
      { alimento_id: "abobora", nome: "Abóbora", acao: "tem" },
      { alimento_id: "cenoura", nome: "Cenoura", acao: "tem" },
      { nome: "Pitaia", acao: "tem" },
    ]
    expect(textoDeCasa(itens, kb)).toBe(
      "Boa, abóbora, cenoura e pitaia em casa. Confirma abaixo que eu guardo em Minha casa. Ainda não conheço pitaia: guardo na sua casa, mas não uso em sugestões.",
    )
  })

  it("monta só a frase de acabou", () => {
    const itens: ItemDeCasaCitado[] = [{ alimento_id: "abobora", nome: "Abóbora", acao: "acabou" }]
    expect(textoDeCasa(itens, kb)).toBe(
      "Entendi, acabou abóbora. Confirma abaixo que eu atualizo Minha casa.",
    )
  })

  it("junta as frases de tem, acabou e desconhecidos quando os itens são todos desconhecidos", () => {
    const itens: ItemDeCasaCitado[] = [
      { nome: "Pitaia", acao: "acabou" },
      { nome: "Jambo", acao: "tem" },
    ]
    expect(textoDeCasa(itens, kb)).toBe(
      "Boa, jambo em casa. Confirma abaixo que eu guardo em Minha casa. Entendi, acabou pitaia. Confirma abaixo que eu atualizo Minha casa. Ainda não conheço pitaia e jambo: guardo na sua casa, mas não uso em sugestões.",
    )
  })
})

describe("textoDeRetorno", () => {
  it.each([
    ["ajudou", "Que bom que chá de gengibre ajudou. Anotei: vai aparecer mais vezes por aqui."],
    [
      "nao_ajudou",
      "Anotei que chá de gengibre não ajudou desta vez. Se quiser, me conta como você está agora que eu penso em outra coisa.",
    ],
    ["nao_fez", "Tudo bem, anotei que você não fez chá de gengibre."],
  ] as const)("usa o texto de %s com o título em minúscula", (resultado, esperado) => {
    const r: RetornoCitado = { resultado, retorno_id: "ret-1", titulo: "Chá de gengibre" }
    expect(textoDeRetorno(r)).toBe(esperado)
  })

  it("sem ligação com uma sugestão, devolve o texto de sem ligação", () => {
    expect(textoDeRetorno({ resultado: "ajudou" })).toBe(textosDaConversa.retornoSemLigacao)
  })
})

describe("textoDeEvitar", () => {
  it("nomeia o grupo novo e pede confirmação", () => {
    const i = interpretacao({ evitar: [{ tipo: "grupo", valor: "amendoim" }] })
    expect(textoDeEvitar(i, perfil(), kb)).toBe(
      "Entendi. A partir de agora não sugiro amendoim, nem nada que leve isso. Já vale para hoje; confirma abaixo para eu guardar em Evitar sempre.",
    )
  })

  it("diz que já está guardado quando o item já está no perfil", () => {
    const i = interpretacao({ evitar: [{ tipo: "grupo", valor: "amendoim" }] })
    const p = perfil({ evitar_sempre: [{ tipo: "grupo", valor: "amendoim", desde: "2026-10-01" }] })
    expect(textoDeEvitar(i, p, kb)).toBe(
      "Isso já está em Evitar sempre: continuo sem sugerir amendoim.",
    )
  })

  it("monta a frase de texto desconhecido junto com a frase de evitar", () => {
    const i = interpretacao({ evitar: [{ tipo: "texto", valor: "pimenta" }] })
    expect(textoDeEvitar(i, perfil(), kb)).toBe(
      "Entendi. A partir de agora não sugiro pimenta, nem nada que leve isso. Já vale para hoje; confirma abaixo para eu guardar em Evitar sempre. Ainda não conheço pimenta, mas vou levar isso em conta nas respostas.",
    )
  })

  it("trata 'não como' novo com id e livre, e 'não como' antigo como já guardado", () => {
    const i = interpretacao({
      nao_come: [{ alimento_id: "leite", nome: "Leite" }, { nome: "Pitaia" }],
    })
    expect(textoDeEvitar(i, perfil(), kb)).toBe(
      "Entendi, você não come leite e pitaia. Já vale para hoje; confirma abaixo para eu guardar.",
    )
    const p = perfil({
      nao_come: [
        { tipo: "alimento", valor: "leite" },
        { tipo: "texto", valor: "pitaia" },
      ],
    })
    expect(textoDeEvitar(i, p, kb)).toBe("Isso eu já tinha guardado: leite e pitaia.")
  })

  it("trata restrição nova e restrição antiga", () => {
    const i = interpretacao({ restricoes: ["vegana", "sem_gluten"] })
    const p = perfil({ restricoes: ["vegana"] })
    expect(textoDeEvitar(i, p, kb)).toBe(
      "Entendi: sua alimentação é sem glúten. Já vale para hoje; confirma abaixo para eu guardar. Isso eu já tinha guardado: vegana.",
    )
  })

  it("mostra só 'já guardado' quando nada é novo", () => {
    const i = interpretacao({ restricoes: ["vegana"] })
    const p = perfil({ restricoes: ["vegana"] })
    expect(textoDeEvitar(i, p, kb)).toBe("Isso eu já tinha guardado: vegana.")
  })

  it("troca nome livre com colchetes angulares pelos caracteres neutros", () => {
    const i = interpretacao({ evitar: [{ tipo: "texto", valor: "<x>" }] })
    expect(textoDeEvitar(i, perfil(), kb)).toContain("não sugiro ‹x›, nem nada que leve isso.")
  })

  it("mantém $& e chaves vindas da pessoa como texto", () => {
    const i = interpretacao({ evitar: [{ tipo: "texto", valor: "$& {titulo} {itens}" }] })
    const texto = textoDeEvitar(i, perfil(), kb)
    expect(texto).toContain("não sugiro $& {titulo} {itens}, nem nada")
    expect(texto).toContain("Ainda não conheço $& {titulo} {itens}, mas")
  })
})
