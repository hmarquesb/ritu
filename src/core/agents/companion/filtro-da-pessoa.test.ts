import { describe, expect, it } from "vitest"
import type { Perfil } from "@/core/accounts/types"
import type { EvitarItem } from "@/core/knowledge/filtros"
import type { Preferencia } from "@/core/preferences/ports"
import { montarFiltro } from "./filtro-da-pessoa"

const DESDE = "2026-11-01T10:00:00.000Z"

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
    atualizado_em: DESDE,
    ...parcial,
  }
}

function preferencia(
  parcial: Partial<Preferencia> & Pick<Preferencia, "item_tipo" | "item_id">,
): Preferencia {
  return {
    conta_id: "conta-1",
    gosto: null,
    ajudou: 0,
    nao_ajudou: 0,
    nao_fez: 0,
    ultimos_resultados: [],
    ultima_sugestao_em: null,
    ...parcial,
  }
}

const vazio = {
  evitarDoDia: [] as EvitarItem[],
  evitarDaMensagem: [] as EvitarItem[],
  preferencias: [] as Preferencia[],
}

describe("montarFiltro: evitar sempre", () => {
  it("o evitar sempre do perfil entra no filtro, com grupo, alimento e texto", () => {
    const { filtro } = montarFiltro({
      ...vazio,
      perfil: perfil({
        evitar_sempre: [
          { tipo: "grupo", valor: "leite", desde: DESDE },
          { tipo: "alimento", valor: "amendoim", desde: DESDE },
          { tipo: "texto", valor: "camarão", desde: DESDE },
        ],
      }),
    })

    expect(filtro.evitar).toEqual([
      { tipo: "grupo", valor: "leite" },
      { tipo: "alimento", valor: "amendoim" },
      { tipo: "texto", valor: "camarão" },
    ])
  })

  it("o evitar do dia entra no filtro", () => {
    const { filtro } = montarFiltro({
      ...vazio,
      perfil: perfil(),
      evitarDoDia: [{ tipo: "grupo", valor: "gluten" }],
    })

    expect(filtro.evitar).toEqual([{ tipo: "grupo", valor: "gluten" }])
  })

  it("o evitar da mensagem entra no filtro", () => {
    const { filtro } = montarFiltro({
      ...vazio,
      perfil: perfil(),
      evitarDaMensagem: [{ tipo: "alimento", valor: "castanha-do-para" }],
    })

    expect(filtro.evitar).toEqual([{ tipo: "alimento", valor: "castanha-do-para" }])
  })

  it("junta as três origens e não repete o mesmo item", () => {
    const { filtro } = montarFiltro({
      perfil: perfil({ evitar_sempre: [{ tipo: "grupo", valor: "leite", desde: DESDE }] }),
      evitarDoDia: [
        { tipo: "grupo", valor: "leite" },
        { tipo: "grupo", valor: "gluten" },
      ],
      evitarDaMensagem: [{ tipo: "grupo", valor: "gluten" }],
      preferencias: [],
    })

    expect(filtro.evitar).toEqual([
      { tipo: "grupo", valor: "leite" },
      { tipo: "grupo", valor: "gluten" },
    ])
  })
})

describe("montarFiltro: texto livre", () => {
  it("item de texto vai para evitar_textos", () => {
    const resultado = montarFiltro({
      ...vazio,
      perfil: perfil({ evitar_sempre: [{ tipo: "texto", valor: "camarão", desde: DESDE }] }),
      evitarDaMensagem: [{ tipo: "texto", valor: "pimenta de cayena" }],
    })

    expect(resultado.evitar_textos).toEqual(["camarão", "pimenta de cayena"])
  })

  it("texto repetido aparece uma vez só em evitar_textos", () => {
    const resultado = montarFiltro({
      ...vazio,
      perfil: perfil({ evitar_sempre: [{ tipo: "texto", valor: "camarão", desde: DESDE }] }),
      evitarDoDia: [{ tipo: "texto", valor: "camarão" }],
      evitarDaMensagem: [{ tipo: "texto", valor: "camarão" }],
    })

    expect(resultado.evitar_textos).toEqual(["camarão"])
  })

  it("grupo e alimento não entram em evitar_textos", () => {
    const resultado = montarFiltro({
      ...vazio,
      perfil: perfil({
        evitar_sempre: [
          { tipo: "grupo", valor: "leite", desde: DESDE },
          { tipo: "alimento", valor: "amendoim", desde: DESDE },
        ],
      }),
    })

    expect(resultado.evitar_textos).toEqual([])
  })

  it("não como de alimento vai para nao_come e nunca para evitar_textos", () => {
    const resultado = montarFiltro({
      ...vazio,
      perfil: perfil({
        nao_come: [
          { tipo: "alimento", valor: "coentro" },
          { tipo: "texto", valor: "jiló" },
        ],
      }),
    })

    expect(resultado.filtro.nao_come).toEqual(["coentro"])
    expect(resultado.evitar_textos).toEqual([])
  })
})

describe("montarFiltro: restrição e não como do dia", () => {
  it("restrição do dia vai para restricoes, sem repetir a do perfil, e fica fora de evitar", () => {
    const resultado = montarFiltro({
      ...vazio,
      perfil: perfil({ restricoes: ["vegetariana"] }),
      evitarDoDia: [
        { tipo: "restricao", valor: "vegetariana" },
        { tipo: "restricao", valor: "sem_gluten" },
      ],
    })

    expect(resultado.filtro.restricoes).toEqual(["vegetariana", "sem_gluten"])
    expect(resultado.filtro.evitar).toEqual([])
    expect(resultado.evitar_textos).toEqual([])
  })

  it("não como do dia vai para nao_come, sem repetir o do perfil, e fica fora de evitar e de evitar_textos", () => {
    const resultado = montarFiltro({
      ...vazio,
      perfil: perfil({ nao_come: [{ tipo: "alimento", valor: "coentro" }] }),
      evitarDoDia: [
        { tipo: "nao_come", valor: "coentro" },
        { tipo: "nao_come", valor: "castanha-do-para" },
        { tipo: "grupo", valor: "gluten" },
      ],
    })

    expect(resultado.filtro.nao_come).toEqual(["coentro", "castanha-do-para"])
    expect(resultado.filtro.evitar).toEqual([{ tipo: "grupo", valor: "gluten" }])
    expect(resultado.evitar_textos).toEqual([])
  })
})

describe("montarFiltro: não como em texto livre do dia", () => {
  it("vai para evitar_textos sem repetir, e fica fora de nao_come e de evitar", () => {
    const resultado = montarFiltro({
      ...vazio,
      perfil: perfil({ evitar_sempre: [{ tipo: "texto", valor: "camarão", desde: DESDE }] }),
      evitarDoDia: [
        { tipo: "nao_come_texto", valor: "jiló" },
        { tipo: "nao_come_texto", valor: "camarão" },
      ],
    })

    expect(resultado.evitar_textos).toEqual(["camarão", "jiló"])
    expect(resultado.filtro.nao_come).toEqual([])
    expect(resultado.filtro.evitar).toEqual([{ tipo: "texto", valor: "camarão" }])
  })
})

describe("montarFiltro: restrições e preferências", () => {
  it("restrições do perfil entram no filtro", () => {
    const { filtro } = montarFiltro({
      ...vazio,
      perfil: perfil({ restricoes: ["vegetariana"] }),
    })

    expect(filtro.restricoes).toEqual(["vegetariana"])
  })

  it("não gosta de alimento entra no filtro; gosta e não gosta de prática ou preparo ficam de fora", () => {
    const { filtro } = montarFiltro({
      ...vazio,
      perfil: perfil(),
      preferencias: [
        preferencia({ item_tipo: "alimento", item_id: "ghee", gosto: "nao_gosta" }),
        preferencia({ item_tipo: "alimento", item_id: "leite", gosto: "gosta" }),
        preferencia({ item_tipo: "pratica", item_id: "massagem", gosto: "nao_gosta" }),
        preferencia({ item_tipo: "preparo", item_id: "khichari", gosto: "nao_gosta" }),
      ],
    })

    expect(filtro.nao_gosta).toEqual(["ghee"])
  })
})

describe("montarFiltro: privacidade", () => {
  it("não há motivo em lugar nenhum: os itens têm só tipo e valor, e o resultado só tem filtro e evitar_textos", () => {
    const resultado = montarFiltro({
      perfil: perfil({ evitar_sempre: [{ tipo: "texto", valor: "camarão", desde: DESDE }] }),
      evitarDoDia: [{ tipo: "grupo", valor: "leite" }],
      evitarDaMensagem: [{ tipo: "texto", valor: "pimenta" }],
      preferencias: [preferencia({ item_tipo: "alimento", item_id: "ghee", gosto: "nao_gosta" })],
    })

    expect(Object.keys(resultado).sort()).toEqual(["evitar_textos", "filtro"])
    for (const item of resultado.filtro.evitar) {
      expect(Object.keys(item).sort()).toEqual(["tipo", "valor"])
    }
    expect(JSON.stringify(resultado)).not.toContain("desde")
    expect(JSON.stringify(resultado)).not.toContain(DESDE)
  })
})
