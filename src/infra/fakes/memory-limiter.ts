import type { Janela, UsageLimiter } from "@/core/limits/ports"

export function createMemoryLimiter(): UsageLimiter {
  const totais = new Map<string, number>()
  const k = (chave: string, janela: Janela, inicio: string) =>
    JSON.stringify([chave, janela, inicio])

  return {
    async consumir(pedidos, janela, inicio) {
      const barrou = pedidos.find((p) => (totais.get(k(p.chave, janela, inicio)) ?? 0) >= p.teto)
      if (barrou) return { ok: false, chave: barrou.chave }
      for (const p of pedidos) {
        const id = k(p.chave, janela, inicio)
        totais.set(id, (totais.get(id) ?? 0) + 1)
      }
      return { ok: true }
    },
    async usado(chave, janela, inicio) {
      return totais.get(k(chave, janela, inicio)) ?? 0
    },
    async apagarAntesDe(inicio) {
      let apagadas = 0
      for (const id of [...totais.keys()]) {
        const [, janela, ini] = JSON.parse(id) as [string, Janela, string]
        if (janela === "dia" && ini < inicio) {
          totais.delete(id)
          apagadas++
        }
      }
      return apagadas
    },
  }
}
