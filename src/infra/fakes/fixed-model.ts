import type { FornecedorDeModelo } from "@/core/llm/fornecedor"
import type { LlmError } from "@/core/runs/agent-runtime"

/** Fornecedor de teste: devolve o primeiro modelo até um rate_limit, depois avança na lista. */
export function createFixedModel(
  modelos: string[] = ["modelo-a", "modelo-b"],
): FornecedorDeModelo & {
  usos: { modelo: string; tokens: { entrada: number; saida: number } }[]
  falhas: { modelo: string; erro: LlmError }[]
} {
  const usos: { modelo: string; tokens: { entrada: number; saida: number } }[] = []
  const falhas: { modelo: string; erro: LlmError }[] = []
  let indice = 0
  let esgotado = false
  let trocaPendente: { de: string } | undefined

  return {
    usos,
    falhas,
    async proximo() {
      const modelo = modelos[indice]
      if (esgotado || modelo === undefined) return null
      if (trocaPendente) {
        const troca = { de: trocaPendente.de, motivo: "429" as const }
        trocaPendente = undefined
        return { modelo, troca }
      }
      return { modelo }
    },
    async usou(modelo, tokens) {
      usos.push({ modelo, tokens })
    },
    async falhou(modelo, erro) {
      falhas.push({ modelo, erro })
      if (erro.code !== "rate_limit") return
      if (indice + 1 < modelos.length) {
        trocaPendente = { de: modelo }
        indice += 1
      } else {
        esgotado = true
      }
    },
  }
}
