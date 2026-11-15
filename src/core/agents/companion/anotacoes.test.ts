import { describe, expect, it } from "vitest"
import type { Perfil } from "@/core/accounts/types"
import type { Interpretacao } from "@/core/agents/interpreter/interpretacao"
import type { Preferencia } from "@/core/preferences/ports"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { acrescentarNaoCome, montarAnotacoes } from "./anotacoes"

const kb = createMiniKnowledge()

function perfil(mudar: Partial<Perfil> = {}): Perfil {
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
    atualizado_em: "2026-11-15T12:00:00.000Z",
    ...mudar,
  }
}

function interpretacao(mudar: Partial<Interpretacao> = {}): Interpretacao {
  return {
    intencoes: ["momento"],
    estados: [],
    itens_casa: [],
    evitar: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
    ...mudar,
  }
}

function gosto(item_id: string): Preferencia {
  return {
    conta_id: "conta-1",
    item_tipo: "alimento",
    item_id,
    gosto: "gosta",
    ajudou: 0,
    nao_ajudou: 0,
    nao_fez: 0,
    ultimos_resultados: [],
    ultima_sugestao_em: null,
  }
}

const extra = { kb, preferencias: [] as Preferencia[] }

describe("montarAnotacoes", () => {
  it("sai vazio com alerta e com suspeito, mesmo com itens", () => {
    const cheia = {
      itens_casa: [{ alimento_id: "canela", nome: "Canela", acao: "tem" as const }],
      nao_come: [{ alimento_id: "mel", nome: "Mel" }],
    }
    expect(montarAnotacoes(interpretacao({ ...cheia, alerta: "fisico" }), perfil(), extra)).toEqual(
      [],
    )
    expect(montarAnotacoes(interpretacao({ ...cheia, suspeito: true }), perfil(), extra)).toEqual(
      [],
    )
  })

  it("sai vazio sem nenhum item novo", () => {
    expect(montarAnotacoes(interpretacao(), perfil(), extra)).toEqual([])
  })

  it("casa_tem e casa_acabou levam os itens da ação, mesmo os que estão em evitar sempre", () => {
    const i = interpretacao({
      itens_casa: [
        { alimento_id: "canela", nome: "Canela", acao: "tem" },
        { nome: "pitaia", acao: "acabou" },
      ],
    })
    const p = perfil({ evitar_sempre: [{ tipo: "alimento", valor: "canela", desde: "x" }] })
    expect(montarAnotacoes(i, p, extra)).toEqual([
      { tipo: "casa_tem", itens: [{ alimento_id: "canela", nome: "Canela" }] },
      { tipo: "casa_acabou", itens: [{ nome: "pitaia" }] },
    ])
  })

  it("evitar_sempre leva só o que não está no perfil", () => {
    const i = interpretacao({
      evitar: [
        { tipo: "texto", valor: "gelados" },
        { tipo: "grupo", valor: "frituras" },
      ],
    })
    const p = perfil({ evitar_sempre: [{ tipo: "grupo", valor: "frituras", desde: "x" }] })
    expect(montarAnotacoes(i, p, extra)).toEqual([
      { tipo: "evitar_sempre", itens: [{ tipo: "texto", valor: "gelados" }] },
    ])
  })

  it("nao_come compara por id ou pelo nome normalizado, e só leva o que é novo", () => {
    const i = interpretacao({
      nao_come: [
        { alimento_id: "mel", nome: "Mel" },
        { alimento_id: "canela", nome: "Canela" },
        { nome: "Pão de Forma" },
        { nome: "pão de forma" },
      ],
    })
    const p = perfil({
      nao_come: [
        { tipo: "alimento", valor: "mel" },
        { tipo: "texto", valor: "pao de forma" },
      ],
    })
    expect(montarAnotacoes(i, p, extra)).toEqual([
      { tipo: "nao_come", itens: [{ alimento_id: "canela", nome: "Canela" }] },
    ])
  })

  it("gosta leva alimento da base que passa no filtro e ainda não tem gosta", () => {
    const i = interpretacao({
      gosta: [
        { alimento_id: "leite", nome: "Leite" },
        { alimento_id: "mel", nome: "Mel" },
        { alimento_id: "banana", nome: "Banana" },
        { alimento_id: "cenoura", nome: "Cenoura" },
      ],
    })
    const p = perfil({
      evitar_sempre: [{ tipo: "alimento", valor: "mel", desde: "x" }],
      nao_come: [{ tipo: "alimento", valor: "banana" }],
    })
    const extraComGosto = { kb, preferencias: [gosto("cenoura")] }
    expect(montarAnotacoes(i, p, extraComGosto)).toEqual([
      { tipo: "gosta", itens: [{ alimento_id: "leite", nome: "Leite" }] },
    ])
  })

  it("restricao leva só as que não estão no perfil", () => {
    const i = interpretacao({ restricoes: ["vegana", "sem_lactose"] })
    const p = perfil({ restricoes: ["vegana"] })
    expect(montarAnotacoes(i, p, extra)).toEqual([{ tipo: "restricao", itens: ["sem_lactose"] }])
  })

  it("junta os tipos na ordem casa_tem, casa_acabou, evitar_sempre, nao_come, gosta e restricao", () => {
    const i = interpretacao({
      itens_casa: [
        { alimento_id: "canela", nome: "Canela", acao: "tem" },
        { nome: "pitaia", acao: "acabou" },
      ],
      evitar: [{ tipo: "texto", valor: "gelados" }],
      nao_come: [{ alimento_id: "mel", nome: "Mel" }],
      gosta: [{ alimento_id: "leite", nome: "Leite" }],
      restricoes: ["vegana"],
    })
    expect(montarAnotacoes(i, perfil(), extra).map((a) => a.tipo)).toEqual([
      "casa_tem",
      "casa_acabou",
      "evitar_sempre",
      "nao_come",
      "gosta",
      "restricao",
    ])
  })
})

describe("montarAnotacoes com o não como do run", () => {
  it("sem nao_come_do_run devolve o mesmo de antes", () => {
    const i = interpretacao({ nao_come: [{ alimento_id: "mel", nome: "Mel" }] })
    expect(montarAnotacoes(i, perfil(), { kb, preferencias: [] })).toEqual(
      montarAnotacoes(i, perfil(), { kb, preferencias: [], nao_come_do_run: [] }),
    )
  })

  it("junta o não como do run à anotação nao_come", () => {
    const i = interpretacao({ nao_come: [{ alimento_id: "mel", nome: "Mel" }] })
    expect(
      montarAnotacoes(i, perfil(), { kb, preferencias: [], nao_come_do_run: ["banana"] }),
    ).toEqual([
      {
        tipo: "nao_come",
        itens: [
          { alimento_id: "mel", nome: "Mel" },
          { alimento_id: "banana", nome: "Banana" },
        ],
      },
    ])
  })

  it("com alerta, sai lista vazia mesmo com nao_come_do_run preenchido", () => {
    const i = interpretacao({ alerta: "fisico" })
    expect(
      montarAnotacoes(i, perfil(), { kb, preferencias: [], nao_come_do_run: ["banana"] }),
    ).toEqual([])
  })
})

describe("acrescentarNaoCome", () => {
  it("cria a anotação nao_come no fim quando não existe", () => {
    const antes = [{ tipo: "restricao" as const, itens: ["vegana" as const] }]
    expect(acrescentarNaoCome(antes, ["mel"], perfil(), kb)).toEqual([
      ...antes,
      { tipo: "nao_come", itens: [{ alimento_id: "mel", nome: "Mel" }] },
    ])
  })

  it("junta a uma anotação existente sem repetir alimento_id", () => {
    const antes = [
      { tipo: "nao_come" as const, itens: [{ alimento_id: "mel", nome: "Mel" }, { nome: "pão" }] },
    ]
    expect(acrescentarNaoCome(antes, ["mel", "banana", "banana"], perfil(), kb)).toEqual([
      {
        tipo: "nao_come",
        itens: [
          { alimento_id: "mel", nome: "Mel" },
          { nome: "pão" },
          { alimento_id: "banana", nome: "Banana" },
        ],
      },
    ])
  })

  it("ignora o que já está no perfil e o que não existe na base", () => {
    const p = perfil({ nao_come: [{ tipo: "alimento", valor: "banana" }] })
    expect(acrescentarNaoCome([], ["banana", "inexistente"], p, kb)).toEqual([])
  })

  it("não mexe nas anotações quando não há nada novo", () => {
    const antes = [{ tipo: "restricao" as const, itens: ["vegana" as const] }]
    expect(acrescentarNaoCome(antes, [], perfil(), kb)).toEqual(antes)
  })
})
