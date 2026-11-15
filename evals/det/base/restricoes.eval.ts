import { describe, expect, it } from "vitest"
import { type FiltroPessoa, passaNoFiltro } from "@/core/knowledge/filtros"
import type { Restricao } from "@/core/knowledge/vocab"
import { getContainer } from "@/infra/container"

const kb = getContainer().knowledge

const filtroCom = (restricao: Restricao): FiltroPessoa => ({
  evitar: [],
  restricoes: [restricao],
  nao_come: [],
  nao_gosta: [],
})

const ehAprovado = (id: string, restricao: Restricao) => {
  const alimento = kb.alimento(id)
  if (!alimento) throw new Error(`alimento ${id} ausente da base`)
  return passaNoFiltro(alimento, filtroCom(restricao), kb).passa
}

describe("restrição vegana", () => {
  it.each(["leite", "iogurte-natural", "queijo-minas", "ricota", "manteiga", "ghee", "ovo", "mel"])(
    "tira %s",
    (id) => {
      expect(ehAprovado(id, "vegana")).toBe(false)
    },
  )

  it("nenhuma prática aprovada usa ingrediente vegano-restrito", () => {
    const filtro = filtroCom("vegana")
    for (const p of kb.praticas.filter((x) => passaNoFiltro(x, filtro, kb).passa)) {
      for (const ing of p.ingredientes) {
        expect(kb.alimento(ing)?.restricoes ?? [], `${p.id} -> ${ing}`).not.toContain("vegana")
      }
    }
  })
})

describe("restrição sem glúten", () => {
  it.each(["pao", "macarrao", "aveia"])("tira %s", (id) => {
    expect(ehAprovado(id, "sem_gluten")).toBe(false)
  })
})
