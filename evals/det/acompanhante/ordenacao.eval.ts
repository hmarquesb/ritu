import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import { filtroVazio } from "@/core/knowledge/filtros"
import { qualidadesDoMomento } from "@/core/knowledge/momento"
import type { Preferencia } from "@/core/preferences/ports"
import { montarCandidatos } from "@/core/ranking/candidatos"
import type { Candidato, TipoDeSugestao } from "@/core/ranking/tipos"
import { getContainer } from "@/infra/container"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"

type Entrada = Parameters<typeof montarCandidatos>[0]

const kb = getContainer().knowledge
const CONTA = "conta-1"
const ESTADOS_BASE = ["com_frio"] as const

function preferencia(
  item_tipo: Preferencia["item_tipo"],
  item_id: string,
  parcial: Partial<Preferencia> = {},
): Preferencia {
  return {
    conta_id: CONTA,
    item_tipo,
    item_id,
    gosto: null,
    ajudou: 0,
    nao_ajudou: 0,
    nao_fez: 0,
    ultimos_resultados: [],
    ultima_sugestao_em: null,
    ...parcial,
  }
}

function entrada(parcial: Partial<Entrada> = {}): Entrada {
  return {
    qualidades: qualidadesDoMomento({ estados: [...ESTADOS_BASE] }, kb),
    estados: [...ESTADOS_BASE],
    momento_do_dia: "jantar",
    filtro: filtroVazio,
    restricoes: [],
    casa: { confirmados: [], incertos: [] },
    preferencias: [],
    sugeridos_hoje: [],
    ...parcial,
  }
}

const candidatos = (parcial: Partial<Entrada> = {}) => montarCandidatos(entrada(parcial), kb)

const doTipo = (lista: Candidato[], tipo: TipoDeSugestao) => lista.filter((c) => c.tipo === tipo)

const achar = (lista: Candidato[], id: string): Candidato => {
  const achado = lista.find((c) => c.id === id)
  if (!achado) throw new Error(`${id} não está nos candidatos`)
  return achado
}

describe("confirmado acima de incerto", () => {
  const casaComGengibre = (campo: "confirmados" | "incertos" | null) => ({
    confirmados: campo === "confirmados" ? ["gengibre"] : [],
    incertos: campo === "incertos" ? ["gengibre"] : [],
  })

  it("o chá de gengibre tem nota maior com o gengibre confirmado, depois incerto, depois ausente", () => {
    const confirmado = achar(candidatos({ casa: casaComGengibre("confirmados") }), "cha-gengibre")
    const incerto = achar(candidatos({ casa: casaComGengibre("incertos") }), "cha-gengibre")
    const ausente = achar(candidatos({ casa: casaComGengibre(null) }), "cha-gengibre")

    expect(confirmado.nota).toBeGreaterThan(incerto.nota)
    expect(incerto.nota).toBeGreaterThan(ausente.nota)
  })

  it("a diferença é a da configuração (uma prática de um ingrediente)", () => {
    const confirmado = achar(candidatos({ casa: casaComGengibre("confirmados") }), "cha-gengibre")
    const incerto = achar(candidatos({ casa: casaComGengibre("incertos") }), "cha-gengibre")

    expect(confirmado.nota - incerto.nota).toBe(
      config.ranking.casa.confirmado - config.ranking.casa.incerto,
    )
  })
})

describe("gosta sobe", () => {
  const semPreferencia = candidatos()
  const posicaoNoTipo = (lista: Candidato[], id: string, tipo: TipoDeSugestao) =>
    doTipo(lista, tipo).findIndex((c) => c.id === id)

  it("o chá de gengibre sobe a nota em exatamente ranking.gosta e não desce", () => {
    const comGosto = candidatos({
      preferencias: [preferencia("pratica", "cha-gengibre", { gosto: "gosta" })],
    })
    const antes = achar(semPreferencia, "cha-gengibre")
    const depois = achar(comGosto, "cha-gengibre")

    expect(depois.gosta).toBe(true)
    expect(depois.nota - antes.nota).toBe(config.ranking.gosta)
    expect(posicaoNoTipo(comGosto, "cha-gengibre", "cha")).toBeLessThanOrEqual(
      posicaoNoTipo(semPreferencia, "cha-gengibre", "cha"),
    )
  })

  it("um candidato no fim da lista de chás sobe quando é gostado", () => {
    const chas = doTipo(semPreferencia, "cha")
    const ultimo = chas.at(-1)
    expect(ultimo, "há chás").toBeDefined()
    if (!ultimo) return

    const comGosto = candidatos({
      preferencias: [preferencia("pratica", ultimo.id, { gosto: "gosta" })],
    })
    expect(posicaoNoTipo(comGosto, ultimo.id, "cha")).toBeLessThan(chas.length - 1)
  })
})

describe("não ajudou seguidos vão para o fim, e um ajudou traz de volta", () => {
  it("dois não ajudou seguidos mandam o chá de gengibre para o fim do tipo", () => {
    const lista = candidatos({
      preferencias: [
        preferencia("pratica", "cha-gengibre", {
          nao_ajudou: 2,
          ultimos_resultados: ["nao_ajudou", "nao_ajudou"],
        }),
      ],
    })
    const chas = doTipo(lista, "cha")

    expect(achar(lista, "cha-gengibre").no_fim).toBe(true)
    expect(chas.at(-1)?.id).toBe("cha-gengibre")
  })

  it("um não ajudou só não manda para o fim", () => {
    const lista = candidatos({
      preferencias: [
        preferencia("pratica", "cha-gengibre", {
          nao_ajudou: 1,
          ultimos_resultados: ["nao_ajudou"],
        }),
      ],
    })
    expect(achar(lista, "cha-gengibre").no_fim).toBe(false)
  })

  it("um ajudou depois dos dois não ajudou tira o chá do fim", () => {
    const lista = candidatos({
      preferencias: [
        preferencia("pratica", "cha-gengibre", {
          ajudou: 1,
          nao_ajudou: 2,
          ultimos_resultados: ["ajudou", "nao_ajudou"],
        }),
      ],
    })
    expect(achar(lista, "cha-gengibre").no_fim).toBe(false)
  })

  it("pelo store: dois contarResultado seguidos mandam para o fim, e um ajudou depois devolve", async () => {
    const clock = createFixedClock("2026-11-15T22:00:00.000Z")
    const stores = createMemoryStores(clock)
    const item = { tipo: "pratica" as const, id: "cha-gengibre" }

    await stores.preferences.contarResultado(CONTA, item, "nao_ajudou")
    await stores.preferences.contarResultado(CONTA, item, "nao_ajudou")
    const apos2 = candidatos({ preferencias: await stores.preferences.ler(CONTA) })
    expect(achar(apos2, "cha-gengibre").no_fim).toBe(true)
    expect(doTipo(apos2, "cha").at(-1)?.id).toBe("cha-gengibre")

    await stores.preferences.contarResultado(CONTA, item, "ajudou")
    const apos3 = candidatos({ preferencias: await stores.preferences.ler(CONTA) })
    expect(achar(apos3, "cha-gengibre").no_fim).toBe(false)
  })
})

describe("no máximo uma novidade", () => {
  // Com tudo em casa, todo candidato é elegível à novidade; o chá já sugerido não é.
  const tudoEmCasa = {
    confirmados: kb.alimentos.map((a) => a.id),
    incertos: [],
  }
  const comSugestao = [preferencia("pratica", "cha-canela", { ultima_sugestao_em: "2026-11-14" })]

  it.each(kb.estados.map((e) => e.id))(
    "%s: no máximo uma novidade, dentro das três primeiras do tipo",
    (estado) => {
      const lista = candidatos({
        estados: [estado],
        qualidades: qualidadesDoMomento({ estados: [estado] }, kb),
        casa: tudoEmCasa,
        preferencias: comSugestao,
      })
      const novidades = lista.filter((c) => c.novidade)

      expect(novidades.length).toBeLessThanOrEqual(1)
      for (const n of novidades) {
        const posicao = doTipo(lista, n.tipo).findIndex((c) => c.id === n.id)
        expect(posicao).toBeLessThan(config.ranking.novidade.posicaoMaxima)
      }
    },
  )

  it("ao menos um estado escolhe exatamente uma novidade", () => {
    const contagens = kb.estados.map(
      (e) =>
        candidatos({
          estados: [e.id],
          qualidades: qualidadesDoMomento({ estados: [e.id] }, kb),
          casa: tudoEmCasa,
          preferencias: comSugestao,
        }).filter((c) => c.novidade).length,
    )
    expect(contagens).toContain(1)
  })

  it("sem nenhuma sugestão anterior, não há novidade", () => {
    const lista = candidatos({ casa: tudoEmCasa })
    expect(lista.filter((c) => c.novidade)).toHaveLength(0)
  })
})
