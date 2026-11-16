import type { UsageLimiter } from "@/core/limits/ports"
import { type Conexao, numaTransacao } from "./mappers"

// Limitador no Postgres. As linhas são criadas e travadas sempre em ordem de chave,
// então consumos simultâneos se enfileiram sem deadlock; se alguma chave está no teto,
// nenhuma soma.
export function createPgLimiter(sql: Conexao): UsageLimiter {
  return {
    async consumir(pedidos, janela, inicio) {
      if (pedidos.length === 0) return { ok: true }
      const chaves = [...new Set(pedidos.map((p) => p.chave))].sort()
      return numaTransacao(sql, async (tx) => {
        for (const chave of chaves) {
          await tx`
            insert into limites (chave, janela, inicio, total)
            values (${chave}, ${janela}, ${inicio}, 0)
            on conflict do nothing`
        }
        const linhas = await tx<{ chave: string; total: number }[]>`
          select chave, total from limites
          where chave in ${tx(chaves)} and janela = ${janela} and inicio = ${inicio}
          order by chave
          for update`
        const totais = new Map(linhas.map((l) => [l.chave, l.total]))
        const barrou = pedidos.find((p) => (totais.get(p.chave) ?? 0) >= p.teto)
        if (barrou) return { ok: false as const, chave: barrou.chave }
        await tx`
          update limites set total = total + 1
          where chave in ${tx(chaves)} and janela = ${janela} and inicio = ${inicio}`
        return { ok: true as const }
      })
    },

    async usado(chave, janela, inicio) {
      const [linha] = await sql<{ total: number }[]>`
        select total from limites
        where chave = ${chave} and janela = ${janela} and inicio = ${inicio}`
      return linha?.total ?? 0
    },

    async apagarAntesDe(inicio) {
      const apagadas = await sql`
        delete from limites where janela = 'dia' and inicio < ${inicio}`
      return apagadas.count
    },
  }
}
