import type { Judge, Veredito } from "@/core/agents/judge/julgar"

type PedidoDoJuiz = { tentativa: number; nota_de_rotina?: string }

/** Juiz de teste que aprova tudo, sem apontamentos. */
export function createApprovingJudge(): Judge {
  return {
    async julgar() {
      return {
        ok: true,
        aprovado: true,
        graves: [],
        registros: [],
        saude_na_proposta: false,
        apontamentos: [],
        modelo: "juiz-fake",
        tokens: { entrada: 0, saida: 0 },
        trocas: 0,
        duracao_ms: 0,
      }
    },
  }
}

/** Juiz de teste que devolve os vereditos na ordem; fila vazia lança. */
export function createScriptedJudge(vereditos: Veredito[]): Judge & { pedidos: PedidoDoJuiz[] } {
  const pedidos: PedidoDoJuiz[] = []
  let indice = 0
  return {
    pedidos,
    async julgar(p) {
      pedidos.push({
        tentativa: p.tentativa,
        ...(p.nota_de_rotina !== undefined ? { nota_de_rotina: p.nota_de_rotina } : {}),
      })
      const veredito = vereditos[indice]
      if (!veredito) throw new Error("vereditos esgotados")
      indice += 1
      return veredito
    },
  }
}
