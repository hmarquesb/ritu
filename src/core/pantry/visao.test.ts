import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Alimento } from "@/core/knowledge/schemas"
import type { Preferencia } from "@/core/preferences/ports"
import type { ItemDaLista } from "@/core/shortages/ports"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import type { ItemDaCasa } from "./types"
import { textoDoMotivo, visaoDaCasa } from "./visao"

const FUSO = "America/Sao_Paulo"
const AGORA = new Date("2026-11-15T15:00:00Z")
const HOJE_ISO = "2026-11-15T12:00:00Z"

const kb = createMiniKnowledge()

// Um alimento a mais, com acento, para checar a ordenação pt-BR.
const acafrao: Alimento = {
  ...(kb.alimento("banana") as Alimento),
  id: "acafrao",
  nome: "Açafrão",
  grupo: "frutas",
}
const kbComAcafrao: KnowledgeBase = {
  ...kb,
  alimento: (id) => (id === "acafrao" ? acafrao : kb.alimento(id)),
}

function item(parcial: Partial<ItemDaCasa> & { id: string }): ItemDaCasa {
  return {
    conta_id: "conta-1",
    alimento_id: null,
    nome_livre: null,
    nome_normalizado: null,
    estado: "tem",
    sempre_tenho: false,
    confirmado_em: HOJE_ISO,
    origem: "conversa",
    ...parcial,
  }
}

function lista(parcial: Partial<ItemDaLista> & { alimento_id: string }): ItemDaLista {
  return {
    conta_id: "conta-1",
    motivo: "pessoa",
    detalhe: "",
    criado_em: "2026-11-15T10:00:00Z",
    ...parcial,
  }
}

function gosto(item_id: string, valor: "gosta" | "nao_gosta"): Preferencia {
  return {
    conta_id: "conta-1",
    item_tipo: "alimento",
    item_id,
    gosto: valor,
    ajudou: 0,
    nao_ajudou: 0,
    nao_fez: 0,
    ultimos_resultados: [],
    ultima_sugestao_em: null,
  }
}

function ver(
  parcial: Partial<{
    itens: ItemDaCasa[]
    lista: ItemDaLista[]
    preferencias: Preferencia[]
    kb: KnowledgeBase
  }> = {},
) {
  return visaoDaCasa({
    itens: [],
    lista: [],
    preferencias: [],
    kb,
    agora: AGORA,
    fuso: FUSO,
    ...parcial,
  })
}

describe("visaoDaCasa: incertos", () => {
  it("incerto só aparece em ainda_tem, do mais antigo para o mais novo, e fora das prateleiras", () => {
    const visao = ver({
      itens: [
        item({ id: "novo", alimento_id: "iogurte-natural", confirmado_em: "2026-10-20T12:00:00Z" }),
        item({ id: "antigo", alimento_id: "leite", confirmado_em: "2026-10-01T12:00:00Z" }),
      ],
    })
    expect(visao.ainda_tem.map((i) => i.id)).toEqual(["antigo", "novo"])
    expect(visao.ainda_tem.every((i) => i.estado === "incerto")).toBe(true)
    expect(visao.prateleiras).toEqual([])
  })
})

describe("visaoDaCasa: prateleiras", () => {
  it("segue a ordem de GRUPOS e ordena os itens de cada uma pelo nome em pt-BR", () => {
    const visao = ver({
      itens: [
        item({ id: "leite", alimento_id: "leite" }),
        item({ id: "canela", alimento_id: "canela" }),
        item({ id: "limao", alimento_id: "limao" }),
        item({ id: "banana", alimento_id: "banana" }),
        item({ id: "arroz", alimento_id: "arroz-branco" }),
      ],
    })
    expect(visao.prateleiras.map((p) => p.grupo)).toEqual([
      "frutas",
      "graos",
      "laticinios",
      "especiarias",
    ])
    expect(visao.prateleiras[0]?.nome).toBe(config.textosCasa.grupos.frutas)
    expect(visao.prateleiras[0]?.itens.map((i) => i.nome)).toEqual(["Banana", "Limão"])
  })

  it("ordena acentuado pelo pt-BR: Açafrão antes de Banana", () => {
    const visao = ver({
      kb: kbComAcafrao,
      itens: [
        item({ id: "banana", alimento_id: "banana" }),
        item({ id: "acafrao", alimento_id: "acafrao" }),
      ],
    })
    expect(visao.prateleiras[0]?.itens.map((i) => i.nome)).toEqual(["Açafrão", "Banana"])
  })

  it("inclui confirmado e sempre_tenho, e sempre_tenho não vai para ainda_tem mesmo antigo", () => {
    const visao = ver({
      itens: [
        item({
          id: "sempre",
          alimento_id: "leite",
          sempre_tenho: true,
          confirmado_em: "2026-01-01T12:00:00Z",
        }),
        item({ id: "hoje", alimento_id: "manteiga" }),
      ],
    })
    expect(visao.ainda_tem).toEqual([])
    expect(visao.prateleiras[0]?.itens.map((i) => i.id)).toEqual(["sempre", "hoje"])
    expect(visao.prateleiras[0]?.itens.find((i) => i.id === "sempre")?.estado).toBe("sempre_tenho")
  })

  it("desconhecidos vão por último, com o nome da config e gosto null", () => {
    const visao = ver({
      preferencias: [gosto("tempero-xyz", "nao_gosta")],
      itens: [
        item({
          id: "tempero",
          nome_livre: "Tempero X",
          alimento_id: null,
          nome_normalizado: "tempero x",
        }),
        item({ id: "banana", alimento_id: "banana" }),
      ],
    })
    expect(visao.prateleiras.map((p) => p.grupo)).toEqual(["frutas", "desconhecidos"])
    const ultima = visao.prateleiras[1]
    expect(ultima?.nome).toBe(config.textosCasa.prateleira.desconhecidos)
    expect(ultima?.itens[0]).toMatchObject({
      nome: "Tempero X",
      grupo: null,
      gosto: null,
      alimento_id: null,
    })
  })

  it("alimento que a base não conhece tem grupo null e gosto null mesmo com preferência", () => {
    const visao = ver({
      preferencias: [gosto("sumiu", "nao_gosta")],
      itens: [item({ id: "x", alimento_id: "sumiu", nome_livre: "Antigo" })],
    })
    expect(visao.prateleiras[0]?.grupo).toBe("desconhecidos")
    expect(visao.prateleiras[0]?.itens[0]).toMatchObject({ grupo: null, gosto: null })
  })
})

describe("visaoDaCasa: acabou, na lista e vazia", () => {
  it("acabou fica separado, em ordem alfabética", () => {
    const visao = ver({
      itens: [
        item({ id: "l", alimento_id: "leite", estado: "acabou" }),
        item({ id: "b", alimento_id: "banana", estado: "acabou" }),
        item({ id: "m", alimento_id: "manteiga" }),
      ],
    })
    expect(visao.acabou.map((i) => i.nome)).toEqual(["Banana", "Leite"])
    expect(visao.prateleiras.flatMap((p) => p.itens.map((i) => i.id))).toEqual(["m"])
  })

  it("na_lista marca o item cujo alimento está na lista", () => {
    const visao = ver({
      itens: [
        item({ id: "leite", alimento_id: "leite" }),
        item({ id: "banana", alimento_id: "banana" }),
      ],
      lista: [lista({ alimento_id: "leite" })],
    })
    const leite = visao.prateleiras.flatMap((p) => p.itens).find((i) => i.id === "leite")
    const banana = visao.prateleiras.flatMap((p) => p.itens).find((i) => i.id === "banana")
    expect(leite?.na_lista).toBe(true)
    expect(banana?.na_lista).toBe(false)
  })

  it("vazia é true sem itens na casa, mesmo com lista", () => {
    const visao = ver({ lista: [lista({ alimento_id: "leite" })] })
    expect(visao.vazia).toBe(true)
    expect(visao.ainda_tem).toEqual([])
    expect(visao.prateleiras).toEqual([])
  })

  it("vazia é false com ao menos um item", () => {
    expect(ver({ itens: [item({ id: "b", alimento_id: "banana" })] }).vazia).toBe(false)
  })

  it("item da lista cujo alimento saiu da base não aparece", () => {
    const visao = ver({
      lista: [lista({ alimento_id: "sumiu" }), lista({ alimento_id: "leite", motivo: "pessoa" })],
    })
    expect(visao.lista.map((l) => l.alimento_id)).toEqual(["leite"])
  })

  it("lista do mais recente para o mais antigo, com nome e texto do motivo", () => {
    const visao = ver({
      lista: [
        lista({ alimento_id: "leite", criado_em: "2026-11-10T10:00:00Z" }),
        lista({
          alimento_id: "banana",
          criado_em: "2026-11-15T10:00:00Z",
          motivo: "faltou_hoje",
          detalhe: "almoço",
        }),
      ],
    })
    expect(visao.lista).toEqual([
      {
        alimento_id: "banana",
        nome: "Banana",
        motivo: "faltou_hoje",
        texto: "Faltou para almoço",
      },
      { alimento_id: "leite", nome: "Leite", motivo: "pessoa", texto: "Você pôs na lista" },
    ])
  })
})

describe("textoDoMotivo", () => {
  it("faltou_hoje usa o detalhe", () => {
    expect(
      textoDoMotivo(lista({ alimento_id: "x", motivo: "faltou_hoje", detalhe: "jantar" })),
    ).toBe("Faltou para jantar")
  })

  it("fez_falta usa o detalhe como contagem", () => {
    expect(textoDoMotivo(lista({ alimento_id: "x", motivo: "fez_falta", detalhe: "3" }))).toBe(
      "Fez falta 3 vezes nos últimos 30 dias",
    )
  })

  it("pessoa usa o texto fixo", () => {
    expect(textoDoMotivo(lista({ alimento_id: "x", motivo: "pessoa" }))).toBe("Você pôs na lista")
  })
})

describe("visaoDaCasa: gosto e dias", () => {
  it("gosto vem da preferência do alimento da conta", () => {
    const visao = ver({
      preferencias: [gosto("leite", "gosta"), gosto("canela", "nao_gosta")],
      itens: [
        item({ id: "leite", alimento_id: "leite" }),
        item({ id: "canela", alimento_id: "canela" }),
        item({ id: "banana", alimento_id: "banana" }),
      ],
    })
    const todos = visao.prateleiras.flatMap((p) => p.itens)
    expect(todos.find((i) => i.id === "leite")?.gosto).toBe("gosta")
    expect(todos.find((i) => i.id === "canela")?.gosto).toBe("nao_gosta")
    expect(todos.find((i) => i.id === "banana")?.gosto).toBeNull()
  })

  it("dias conta dias locais, atravessando a meia-noite no fuso", () => {
    // 02:30 UTC de 15/11 é 23:30 de 14/11 em São Paulo; agora são 12:00 de 15/11 ali.
    const visao = ver({
      itens: [item({ id: "leite", alimento_id: "leite", confirmado_em: "2026-11-15T02:30:00Z" })],
    })
    expect(visao.prateleiras[0]?.itens[0]?.dias).toBe(1)
  })

  it("dias é zero para o que foi confirmado hoje", () => {
    const visao = ver({ itens: [item({ id: "b", alimento_id: "banana" })] })
    expect(visao.prateleiras[0]?.itens[0]?.dias).toBe(0)
  })
})
