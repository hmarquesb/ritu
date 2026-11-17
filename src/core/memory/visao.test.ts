import { describe, expect, it } from "vitest"
import type { Perfil } from "@/core/accounts/types"
import type { FiltroPessoa } from "@/core/knowledge/filtros"
import { filtroVazio } from "@/core/knowledge/filtros"
import type { CasaNaTela, ItemNaCasa } from "@/core/pantry/visao"
import type { Padrao } from "@/core/patterns/ports"
import type { Preferencia } from "@/core/preferences/ports"
import type { NotaDeRotina, ResumoDeRotina } from "@/core/routine/ports"
import type { ItemDaLista } from "@/core/shortages/ports"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { visaoDaMemoria } from "./visao"

const kb = createMiniKnowledge()
const FUSO = "America/Sao_Paulo"
// 23h de 16/11 em Brasília: o dia local ainda é 16/11, embora em UTC já seja 17/11.
const AGORA = new Date("2026-11-17T02:00:00Z")
const CONTA = "conta-1"

const CASA_VAZIA: CasaNaTela = {
  ainda_tem: [],
  prateleiras: [],
  acabou: [],
  lista: [],
  vazia: true,
}

function perfilVazio(over: Partial<Perfil> = {}): Perfil {
  return {
    conta_id: CONTA,
    prakriti: null,
    origem: null,
    evitar_sempre: [],
    restricoes: [],
    nao_come: [],
    cidade_nome: null,
    cidade_lat: null,
    cidade_lon: null,
    cidade_fuso: null,
    atualizado_em: "2026-11-01T00:00:00Z",
    ...over,
  }
}

function itemCasa(over: Partial<ItemNaCasa> & { nome: string }): ItemNaCasa {
  return {
    id: over.id ?? `item-${over.nome}`,
    alimento_id: over.alimento_id ?? null,
    nome: over.nome,
    grupo: null,
    estado: over.estado ?? "confirmado",
    dias: 0,
    sempre_tenho: false,
    gosto: null,
    na_lista: false,
  }
}

function preferencia(
  over: Partial<Preferencia> & Pick<Preferencia, "item_tipo" | "item_id">,
): Preferencia {
  return {
    conta_id: CONTA,
    gosto: null,
    ajudou: 0,
    nao_ajudou: 0,
    nao_fez: 0,
    ultimos_resultados: [],
    ultima_sugestao_em: null,
    ...over,
  }
}

function padrao(over: Partial<Padrao> & Pick<Padrao, "id" | "status">): Padrao {
  return {
    conta_id: CONTA,
    tipo: "ajuda_em_estado",
    chave: "com_frio|pratica:cha-gengibre",
    frase: "Quando você está com frio, chá de gengibre costuma te ajudar.",
    ocorrencias: 3,
    criado_em: "2026-11-01T00:00:00Z",
    decidido_em: null,
    ...over,
  }
}

type Entrada = Parameters<typeof visaoDaMemoria>[0]

function entrada(over: Partial<Entrada> = {}): Entrada {
  return {
    perfil: perfilVazio(),
    casa: CASA_VAZIA,
    preferencias: [],
    faltas: [],
    lista: [],
    notas: [],
    resumo: undefined,
    padroes: [],
    filtro: filtroVazio,
    conversa: [],
    kb,
    agora: AGORA,
    fuso: FUSO,
    ...over,
  }
}

describe("visaoDaMemoria: fixos", () => {
  it("nível cheio: dosha do quiz, cidade, evitar sempre, restrições e não como", () => {
    const tela = visaoDaMemoria(
      entrada({
        perfil: perfilVazio({
          prakriti: { vata: 1 },
          origem: "quiz",
          cidade_nome: "Belo Horizonte",
          restricoes: ["vegetariana"],
          evitar_sempre: [
            { tipo: "grupo", valor: "amendoim", desde: "2026-11-01T00:00:00Z" },
            { tipo: "alimento", valor: "leite", desde: "2026-11-02T00:00:00Z" },
            { tipo: "texto", valor: "pimenta", desde: "2026-11-03T00:00:00Z" },
          ],
          nao_come: [
            { tipo: "alimento", valor: "leite" },
            { tipo: "texto", valor: "coentro" },
          ],
        }),
      }),
    )
    expect(tela.fixos.dosha).toEqual({ nome: "Vata", origem: "quiz" })
    expect(tela.fixos.cidade).toBe("Belo Horizonte")
    expect(tela.fixos.restricoes).toEqual(["vegetariana"])
    expect(tela.fixos.evitar).toEqual([
      { tipo: "grupo", valor: "amendoim", nome: "Amendoim" },
      { tipo: "alimento", valor: "leite", nome: "Leite" },
      { tipo: "texto", valor: "pimenta", nome: "pimenta" },
    ])
    expect(tela.fixos.nao_come).toEqual([
      { tipo: "alimento", valor: "leite", nome: "Leite" },
      { tipo: "texto", valor: "coentro", nome: "coentro" },
    ])
  })

  it("dosha declarado quando a origem não veio do quiz", () => {
    const tela = visaoDaMemoria(
      entrada({ perfil: perfilVazio({ prakriti: { pitta: 1 }, origem: "declarado" }) }),
    )
    expect(tela.fixos.dosha).toEqual({ nome: "Pitta", origem: "declarado" })
  })

  it("nível vazio: sem dosha, sem cidade e listas vazias", () => {
    const tela = visaoDaMemoria(entrada())
    expect(tela.fixos).toEqual({
      dosha: null,
      cidade: null,
      evitar: [],
      restricoes: [],
      nao_come: [],
    })
  })
})

describe("visaoDaMemoria: casa", () => {
  it("conta itens, para confirmar, acabaram e a lista Para ter em casa", () => {
    const casa: CasaNaTela = {
      ainda_tem: [itemCasa({ nome: "Gengibre", estado: "incerto" })],
      prateleiras: [
        {
          grupo: "laticinios",
          nome: "Laticínios",
          itens: [itemCasa({ nome: "Leite" }), itemCasa({ nome: "Iogurte" })],
        },
      ],
      acabou: [itemCasa({ nome: "Cardamomo", estado: "acabou" })],
      lista: [],
      vazia: false,
    }
    const lista: ItemDaLista[] = [
      {
        conta_id: CONTA,
        alimento_id: "leite",
        motivo: "pessoa",
        detalhe: "",
        criado_em: "2026-11-10T00:00:00Z",
      },
    ]
    const tela = visaoDaMemoria(entrada({ casa, lista }))
    expect(tela.casa).toEqual({ itens: 4, incertos: 1, acabou: 1, na_lista: 1 })
  })

  it("casa vazia zera os contadores", () => {
    const tela = visaoDaMemoria(entrada())
    expect(tela.casa).toEqual({ itens: 0, incertos: 0, acabou: 0, na_lista: 0 })
  })
})

describe("visaoDaMemoria: gostos e resultados", () => {
  it("só traz itens com gosto ou contador, do item que existe na base, em ordem alfabética", () => {
    const tela = visaoDaMemoria(
      entrada({
        preferencias: [
          preferencia({ item_tipo: "alimento", item_id: "leite", gosto: "nao_gosta" }),
          preferencia({ item_tipo: "pratica", item_id: "cha-gengibre", ajudou: 3, nao_ajudou: 1 }),
          preferencia({ item_tipo: "alimento", item_id: "leite-sem-base" }),
          preferencia({ item_tipo: "pratica", item_id: "cha-canela-cardamomo" }),
          preferencia({
            item_tipo: "preparo",
            item_id: "arroz-com-legume",
            gosto: "gosta",
            nao_fez: 1,
          }),
        ],
      }),
    )
    expect(tela.gostos.map((g) => g.nome)).toEqual(["Arroz com legume", "Chá de gengibre", "Leite"])
    expect(tela.gostos[1]).toEqual({
      item_tipo: "pratica",
      item_id: "cha-gengibre",
      nome: "Chá de gengibre",
      gosto: null,
      ajudou: 3,
      nao_ajudou: 1,
      nao_fez: 0,
    })
  })

  it("sem preferências, a lista fica vazia", () => {
    expect(visaoDaMemoria(entrada()).gostos).toEqual([])
  })
})

describe("visaoDaMemoria: o que fez falta", () => {
  it("ordena do que mais dias faltou para o que menos, marca a lista e deixa de fora o que não está na base", () => {
    const tela = visaoDaMemoria(
      entrada({
        faltas: [
          { alimento_id: "leite", dias: 1 },
          { alimento_id: "alimento-fora-da-base", dias: 9 },
          { alimento_id: "gengibre", dias: 3 },
        ],
        lista: [
          {
            conta_id: CONTA,
            alimento_id: "gengibre",
            motivo: "fez_falta",
            detalhe: "",
            criado_em: "2026-11-10T00:00:00Z",
          },
        ],
      }),
    )
    expect(tela.faltas).toEqual([
      { alimento_id: "gengibre", nome: "Gengibre", dias: 3, na_lista: true },
      { alimento_id: "leite", nome: "Leite", dias: 1, na_lista: false },
    ])
  })
})

describe("visaoDaMemoria: rotina", () => {
  it("traz o resumo e as notas ativas, da mais recente para a mais antiga", () => {
    const notas: NotaDeRotina[] = [
      {
        id: "n1",
        conta_id: CONTA,
        texto: "Acordo cedo",
        ativa: true,
        criado_em: "2026-11-01T10:00:00Z",
      },
      {
        id: "n2",
        conta_id: CONTA,
        texto: "Trabalho à noite",
        ativa: true,
        criado_em: "2026-11-05T10:00:00Z",
      },
      {
        id: "n3",
        conta_id: CONTA,
        texto: "Apagada",
        ativa: false,
        criado_em: "2026-11-06T10:00:00Z",
      },
    ]
    const resumo: ResumoDeRotina = {
      conta_id: CONTA,
      versao: 2,
      texto: "Rotina de manhã cedo.",
      criado_em: "2026-11-05T11:00:00Z",
    }
    const tela = visaoDaMemoria(entrada({ notas, resumo }))
    expect(tela.rotina.resumo).toBe("Rotina de manhã cedo.")
    expect(tela.rotina.notas).toEqual([
      { id: "n2", texto: "Trabalho à noite", criado_em: "2026-11-05T10:00:00Z" },
      { id: "n1", texto: "Acordo cedo", criado_em: "2026-11-01T10:00:00Z" },
    ])
  })

  it("sem resumo nem notas, o resumo é null e as notas vazias", () => {
    expect(visaoDaMemoria(entrada()).rotina).toEqual({ resumo: null, notas: [] })
  })
})

describe("visaoDaMemoria: padrões", () => {
  it("candidato barrado pelo filtro some", () => {
    const filtro: FiltroPessoa = {
      ...filtroVazio,
      evitar: [{ tipo: "alimento", valor: "gengibre" }],
    }
    const tela = visaoDaMemoria(
      entrada({
        filtro,
        padroes: [padrao({ id: "p1", status: "candidato" })],
      }),
    )
    expect(tela.padroes).toEqual([])
  })

  it("candidato que vale aparece; a ordem é candidatos do mais antigo, depois confirmados e recusados do mais recente", () => {
    const tela = visaoDaMemoria(
      entrada({
        padroes: [
          padrao({ id: "conf-antigo", status: "confirmado", decidido_em: "2026-11-02T00:00:00Z" }),
          padrao({ id: "rec-recente", status: "recusado", decidido_em: "2026-11-09T00:00:00Z" }),
          padrao({ id: "cand-novo", status: "candidato", criado_em: "2026-11-08T00:00:00Z" }),
          padrao({ id: "cand-antigo", status: "candidato", criado_em: "2026-11-03T00:00:00Z" }),
          padrao({ id: "rec-antigo", status: "recusado", decidido_em: "2026-11-04T00:00:00Z" }),
          padrao({ id: "conf-recente", status: "confirmado", decidido_em: "2026-11-10T00:00:00Z" }),
        ],
      }),
    )
    expect(tela.padroes.map((p) => [p.id, p.status])).toEqual([
      ["cand-antigo", "candidato"],
      ["cand-novo", "candidato"],
      ["conf-recente", "confirmado"],
      ["conf-antigo", "confirmado"],
      ["rec-recente", "recusado"],
      ["rec-antigo", "recusado"],
    ])
    expect(tela.padroes[0]).toEqual({
      id: "cand-antigo",
      frase: "Quando você está com frio, chá de gengibre costuma te ajudar.",
      status: "candidato",
      decidido_em: null,
    })
  })
})

describe("visaoDaMemoria: conversa", () => {
  it("nomeia os dias no fuso e deixa de fora o que cai fora dos últimos 7 dias ou no futuro", () => {
    const tela = visaoDaMemoria(
      entrada({
        conversa: [
          { dia: "2026-11-17", total: 2 }, // amanhã em Brasília: fora
          { dia: "2026-11-16", total: 4 },
          { dia: "2026-11-15", total: 6 },
          { dia: "2026-11-10", total: 1 }, // Há 6 dias: dentro
          { dia: "2026-11-09", total: 5 }, // Há 7 dias: fora
        ],
      }),
    )
    expect(tela.conversa).toEqual([
      { dia: "2026-11-16", nome: "Hoje", total: 4 },
      { dia: "2026-11-15", nome: "Ontem", total: 6 },
      { dia: "2026-11-10", nome: "Há 6 dias", total: 1 },
    ])
  })
})

describe("visaoDaMemoria: pura", () => {
  it("não altera a entrada", () => {
    const padroes = [
      padrao({ id: "b", status: "recusado", decidido_em: "2026-11-01T00:00:00Z" }),
      padrao({ id: "a", status: "candidato" }),
    ]
    const copia = structuredClone(padroes)
    visaoDaMemoria(entrada({ padroes }))
    expect(padroes).toEqual(copia)
  })
})
