import { describe, expect, it } from "vitest"
import { checarCombinacao } from "@/core/knowledge/combinacoes"
import type { Alimento, Combinacao } from "@/core/knowledge/schemas"
import { getContainer } from "@/infra/container"

const kb = getContainer().knowledge

// Oráculo independente de casaItem: "alimento:<id>" | "grupo:<grupo>" | "marca:<marca>".
function casa(item: string, alimento: Alimento): boolean {
  const [tipo, valor = ""] = item.split(":")
  if (tipo === "alimento") return alimento.id === valor
  if (tipo === "grupo") return alimento.grupo === valor
  if (tipo === "marca") return (alimento.marcas as string[]).includes(valor)
  return false
}

function idsQueCasam(item: string): string[] {
  return kb.alimentos.filter((a) => casa(item, a)).map((a) => a.id)
}

// Um par de alimentos distintos, um para cada um de dois itens da linha.
function exemploDe(linha: Combinacao): [string, string] | undefined {
  for (let i = 0; i < linha.itens.length; i++) {
    for (let j = i + 1; j < linha.itens.length; j++) {
      const xs = idsQueCasam(linha.itens[i] ?? "")
      const ys = idsQueCasam(linha.itens[j] ?? "")
      for (const x of xs) {
        const y = ys.find((candidato) => candidato !== x)
        if (y !== undefined) return [x, y]
      }
    }
  }
  return undefined
}

describe("combinações da base real", () => {
  it.each(kb.combinacoes)("$id: um exemplo de par dispara a linha", (linha) => {
    const par = exemploDe(linha)
    expect(par, `nenhum par de alimentos casa com ${linha.itens.join(" x ")}`).toBeDefined()
    if (!par) return

    const { conflitos } = checarCombinacao(par, kb)
    expect(conflitos.map((c) => c.linha_base)).toContain(`combinacoes:${linha.id}`)
  })
})
