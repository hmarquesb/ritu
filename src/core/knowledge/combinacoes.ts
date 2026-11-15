import type { KnowledgeBase } from "./knowledge-base"
import type { Alimento, Combinacao } from "./schemas"

export type Conflito = { itens: [string, string]; motivo: string; linha_base: string }
export type ResultadoCombinacao = { compativel: boolean; conflitos: Conflito[] }

// Item da combinação: "alimento:<id>" | "grupo:<grupo>" | "marca:<marca>".
function casaItem(item: string, alimento: Alimento): boolean {
  const [tipo, valor = ""] = item.split(":")
  if (tipo === "alimento") return alimento.id === valor
  if (tipo === "grupo") return alimento.grupo === valor
  if (tipo === "marca") return (alimento.marcas as string[]).includes(valor)
  return false
}

function idsQueCasam(item: string, ids: string[], kb: KnowledgeBase): string[] {
  return ids.filter((id) => {
    const alimento = kb.alimento(id)
    return alimento !== undefined && casaItem(item, alimento)
  })
}

// Há dois ids diferentes, um para cada lado.
function temParDistinto(xs: string[], ys: string[]): boolean {
  return xs.some((x) => ys.some((y) => x !== y))
}

function conflitoDaLinha(
  linha: Combinacao,
  ids: string[],
  kb: KnowledgeBase,
): Conflito | undefined {
  const quem = linha.itens.map((item) => idsQueCasam(item, ids, kb))
  for (let i = 0; i < linha.itens.length; i++) {
    for (let j = i + 1; j < linha.itens.length; j++) {
      const [a, b] = [linha.itens[i] ?? "", linha.itens[j] ?? ""]
      if (temParDistinto(quem[i] ?? [], quem[j] ?? [])) {
        return { itens: [a, b], motivo: linha.motivo, linha_base: `combinacoes:${linha.id}` }
      }
    }
  }
  return undefined
}

export function checarCombinacao(ids: string[], kb: KnowledgeBase): ResultadoCombinacao {
  const conflitos: Conflito[] = []
  for (const linha of kb.combinacoes) {
    const conflito = conflitoDaLinha(linha, ids, kb)
    if (conflito) conflitos.push(conflito)
  }
  return { compativel: conflitos.length === 0, conflitos }
}
