import { describe, expect, it } from "vitest"
import { createMiniKnowledge, miniDados } from "@/infra/fakes/mini-knowledge"
import { type FiltroPessoa, filtroVazio, passaNoFiltro, serveAVaga } from "./filtros"
import type { Alimento, Pratica, Preparo, Vaga } from "./schemas"

const kb = createMiniKnowledge()

function alimento(id: string): Alimento {
  const a = kb.alimento(id)
  if (!a) throw new Error(`alimento ${id} ausente na mini-base`)
  return a
}

function pratica(id: string): Pratica {
  const p = kb.pratica(id)
  if (!p) throw new Error(`prática ${id} ausente na mini-base`)
  return p
}

function preparo(id: string): Preparo {
  const p = kb.preparo(id)
  if (!p) throw new Error(`preparo ${id} ausente na mini-base`)
  return p
}

function com(parcial: Partial<FiltroPessoa>): FiltroPessoa {
  return { ...filtroVazio, ...parcial }
}

describe("passaNoFiltro", () => {
  it("filtro vazio deixa passar qualquer alimento", () => {
    for (const a of miniDados.alimentos) {
      expect(passaNoFiltro(a, filtroVazio, kb)).toEqual({ passa: true })
    }
  })

  it("grupo leite em evitar tira os laticínios e o preparo que depende deles", () => {
    const filtro = com({ evitar: [{ tipo: "grupo", valor: "leite" }] })

    for (const id of ["leite", "iogurte-natural", "manteiga", "ghee"]) {
      expect(passaNoFiltro(alimento(id), filtro, kb)).toEqual({
        passa: false,
        motivo: "evitar_sempre",
      })
    }
    expect(passaNoFiltro(preparo("leite-morno-com-especiaria"), filtro, kb)).toEqual({
      passa: false,
      motivo: "evitar_sempre",
    })
  })

  it("grupo leite em evitar não tira prática sem laticínio", () => {
    const filtro = com({ evitar: [{ tipo: "grupo", valor: "leite" }] })

    expect(passaNoFiltro(pratica("cha-gengibre"), filtro, kb)).toEqual({ passa: true })
  })

  it("nenhuma prática com ingrediente de grupo evitado passa", () => {
    const filtro = com({ evitar: [{ tipo: "grupo", valor: "gergelim" }] })

    expect(passaNoFiltro(pratica("oleo-pes-gergelim"), filtro, kb).passa).toBe(false)
  })

  it("grupo gergelim tira o óleo de gergelim e deixa passar o óleo de coco", () => {
    const filtro = com({ evitar: [{ tipo: "grupo", valor: "gergelim" }] })

    expect(passaNoFiltro(pratica("oleo-pes-gergelim"), filtro, kb)).toEqual({
      passa: false,
      motivo: "evitar_sempre",
    })
    expect(passaNoFiltro(pratica("oleo-pes-coco"), filtro, kb)).toEqual({ passa: true })
  })

  it("texto que bate com sinônimo normalizado tira o alimento", () => {
    const filtro = com({ evitar: [{ tipo: "texto", valor: "Jerimum" }] })

    expect(passaNoFiltro(alimento("abobora"), filtro, kb)).toEqual({
      passa: false,
      motivo: "evitar_sempre",
    })
  })

  it("restrição vegana tira o mel e a prática que o sugere", () => {
    const filtro = com({ restricoes: ["vegana"] })

    expect(passaNoFiltro(alimento("mel"), filtro, kb)).toEqual({
      passa: false,
      motivo: "restricao",
    })
    expect(passaNoFiltro(pratica("cha-gengibre-limao-mel"), filtro, kb)).toEqual({
      passa: false,
      motivo: "restricao",
    })
  })

  it("alimento que a pessoa não come reprova com nao_come", () => {
    const filtro = com({ nao_come: ["cenoura"] })

    expect(passaNoFiltro(alimento("cenoura"), filtro, kb)).toEqual({
      passa: false,
      motivo: "nao_come",
    })
  })

  it("alimento que a pessoa não gosta reprova com nao_gosta", () => {
    const filtro = com({ nao_gosta: ["cenoura"] })

    expect(passaNoFiltro(alimento("cenoura"), filtro, kb)).toEqual({
      passa: false,
      motivo: "nao_gosta",
    })
  })

  it("preparo cuja única opção de vaga obrigatória está em nao_gosta reprova com nao_gosta", () => {
    const filtro = com({ nao_gosta: ["leite", "iogurte-natural", "ghee"] })

    expect(passaNoFiltro(preparo("leite-morno-com-especiaria"), filtro, kb)).toEqual({
      passa: false,
      motivo: "nao_gosta",
    })
  })

  it("preparo passa enquanto cada vaga obrigatória tem alguma opção aprovada", () => {
    const filtro = com({ nao_gosta: ["leite"] })

    expect(passaNoFiltro(preparo("leite-morno-com-especiaria"), filtro, kb)).toEqual({
      passa: true,
    })
  })

  it("prática reprova se algum ingrediente reprova", () => {
    const filtro = com({ nao_gosta: ["gengibre"] })

    expect(passaNoFiltro(pratica("cha-gengibre"), filtro, kb)).toEqual({
      passa: false,
      motivo: "nao_gosta",
    })
  })

  it("filtro não altera a base da mini-base", () => {
    const antes = JSON.stringify(miniDados.alimentos)
    passaNoFiltro(alimento("leite"), com({ evitar: [{ tipo: "grupo", valor: "leite" }] }), kb)

    expect(JSON.stringify(miniDados.alimentos)).toBe(antes)
  })
})

describe("serveAVaga", () => {
  it("com lista explícita, aceita só os ids da lista que têm a função", () => {
    const vaga: Pick<Vaga, "funcao" | "alimentos"> = {
      funcao: "liquido",
      alimentos: ["leite", "manteiga"],
    }

    expect(serveAVaga(alimento("leite"), vaga)).toBe(true)
    expect(serveAVaga(alimento("manteiga"), vaga)).toBe(false)
  })

  it("com lista explícita, recusa alimento com a função que não está na lista", () => {
    const vaga: Pick<Vaga, "funcao" | "alimentos"> = { funcao: "liquido", alimentos: ["leite"] }

    expect(serveAVaga(alimento("iogurte-natural"), vaga)).toBe(false)
  })

  it("sem lista, vale a função e o grupo", () => {
    const comGrupo: Pick<Vaga, "funcao" | "grupos"> = {
      funcao: "liquido",
      grupos: ["laticinios"],
    }
    const outroGrupo: Pick<Vaga, "funcao" | "grupos"> = { funcao: "liquido", grupos: ["oleos"] }
    const semGrupo: Pick<Vaga, "funcao"> = { funcao: "liquido" }

    expect(serveAVaga(alimento("iogurte-natural"), comGrupo)).toBe(true)
    expect(serveAVaga(alimento("iogurte-natural"), outroGrupo)).toBe(false)
    expect(serveAVaga(alimento("iogurte-natural"), semGrupo)).toBe(true)
    expect(serveAVaga(alimento("manteiga"), semGrupo)).toBe(false)
  })
})
