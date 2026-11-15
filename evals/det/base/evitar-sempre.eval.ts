import { describe, expect, it } from "vitest"
import { candidatosDaVaga, type FiltroPessoa, passaNoFiltro } from "@/core/knowledge/filtros"
import { getContainer } from "@/infra/container"

const kb = getContainer().knowledge

const GRUPOS = [
  "amendoim",
  "castanhas",
  "leite",
  "ovo",
  "soja",
  "trigo",
  "gergelim",
  "peixe",
  "frutos_do_mar",
] as const

const LATICINIOS_E_GHEE = ["leite", "iogurte-natural", "queijo-minas", "ricota", "manteiga", "ghee"]

const filtroPara = (grupo: string): FiltroPessoa => ({
  evitar: [{ tipo: "grupo", valor: grupo }],
  restricoes: [],
  nao_come: [],
  nao_gosta: [],
})

const aprovados = (filtro: FiltroPessoa) => ({
  alimentos: kb.alimentos.filter((a) => passaNoFiltro(a, filtro, kb).passa),
  preparos: kb.preparos.filter((p) => passaNoFiltro(p, filtro, kb).passa),
  praticas: kb.praticas.filter((p) => passaNoFiltro(p, filtro, kb).passa),
})

const aprovadoOuFalha = (id: string, grupo: string) => {
  const alimento = kb.alimento(id)
  if (!alimento) throw new Error(`alimento ${id} ausente da base`)
  return passaNoFiltro(alimento, filtroPara(grupo), kb).passa
}

describe("evitar sempre: nenhum item aprovado contém o grupo", () => {
  it.each(GRUPOS)("grupo %s: alimentos, práticas e preparos aprovados não contêm o grupo", (g) => {
    const { alimentos, preparos, praticas } = aprovados(filtroPara(g))

    for (const a of alimentos) expect(a.grupos_evitar, a.id).not.toContain(g)
    for (const p of praticas) {
      for (const ing of p.ingredientes) {
        expect(kb.alimento(ing)?.grupos_evitar ?? [], `${p.id} -> ${ing}`).not.toContain(g)
      }
    }
    // Preparo não lista ingredientes: cada vaga obrigatória precisa de um alimento aprovado.
    for (const p of preparos) {
      for (const vaga of p.vagas.filter((v) => v.obrigatoria)) {
        const sobra = candidatosDaVaga(vaga, kb).some(
          (a) => passaNoFiltro(a, filtroPara(g), kb).passa,
        )
        expect(sobra, `${p.id} vaga ${vaga.funcao}`).toBe(true)
      }
    }
  })
})

describe("grupo leite", () => {
  it.each(LATICINIOS_E_GHEE)("tira %s", (id) => {
    expect(aprovadoOuFalha(id, "leite")).toBe(false)
  })

  it("tira o preparo leite-morno-com-especiaria", () => {
    const preparo = kb.preparo("leite-morno-com-especiaria")
    expect(preparo && passaNoFiltro(preparo, filtroPara("leite"), kb).passa).toBe(false)
  })

  it("tira toda prática com laticínio ou ghee como ingrediente", () => {
    const { praticas } = aprovados(filtroPara("leite"))
    const comLacteo = kb.praticas.filter((p) =>
      p.ingredientes.some((ing) => LATICINIOS_E_GHEE.includes(ing)),
    )

    for (const p of comLacteo) expect(praticas.map((x) => x.id)).not.toContain(p.id)
  })
})

describe("grupo gergelim", () => {
  it.each(["oleo-pes-gergelim", "oleo-barriga-gergelim", "oleo-corpo-gergelim"])(
    "tira %s",
    (id) => {
      const pratica = kb.pratica(id)
      expect(pratica && passaNoFiltro(pratica, filtroPara("gergelim"), kb).passa).toBe(false)
    },
  )
})

describe("peixe e frutos do mar não tiram nada", () => {
  it.each(["peixe", "frutos_do_mar"])("grupo %s: tudo continua aprovado", (g) => {
    const { alimentos, preparos, praticas } = aprovados(filtroPara(g))

    expect(alimentos).toHaveLength(kb.alimentos.length)
    expect(preparos).toHaveLength(kb.preparos.length)
    expect(praticas).toHaveLength(kb.praticas.length)
  })
})
