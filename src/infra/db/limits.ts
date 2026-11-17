import type { UsageLimiter } from "@/core/limits/ports"
import { type Conexao, numaTransacao } from "./mappers"

// Limitador no Postgres. Cada par (chave, início) tem a sua linha; as linhas são criadas e travadas
// sempre na mesma ordem, então consumos simultâneos se enfileiram sem deadlock. Se algum par está
// no teto, nenhum soma.
export function createPgLimiter(sql: Conexao): UsageLimiter {
  return {
    async consumir(pedidos, janela, inicio) {
      if (pedidos.length === 0) return { ok: true }
      const pares = paresOrdenados(pedidos, inicio)
      return numaTransacao(sql, async (tx) => {
        const totais = new Map<string, number>()
        for (const { chave, inicio: ini } of pares) {
          await tx`
            insert into limites (chave, janela, inicio, total)
            values (${chave}, ${janela}, ${ini}, 0)
            on conflict do nothing`
          const [linha] = await tx<{ total: number }[]>`
            select total from limites
            where chave = ${chave} and janela = ${janela} and inicio = ${ini}
            for update`
          totais.set(idDoPar(chave, ini), linha?.total ?? 0)
        }
        const barrou = pedidos.find(
          (p) => (totais.get(idDoPar(p.chave, p.inicio ?? inicio)) ?? 0) >= p.teto,
        )
        if (barrou) return { ok: false as const, chave: barrou.chave }
        for (const { chave, inicio: ini } of pares) {
          await tx`
            update limites set total = total + 1
            where chave = ${chave} and janela = ${janela} and inicio = ${ini}`
        }
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
        delete from limites
        where (janela = 'dia' and inicio < ${inicio})
           or (janela = 'minuto' and left(inicio, 10) < ${inicio})`
      return apagadas.count
    },
  }
}

const idDoPar = (chave: string, inicio: string) => JSON.stringify([chave, inicio])

// Pares únicos (chave, início), na ordem de travamento: primeiro a chave, depois o início.
function paresOrdenados(
  pedidos: { chave: string; inicio?: string }[],
  inicioPadrao: string,
): { chave: string; inicio: string }[] {
  const mapa = new Map<string, { chave: string; inicio: string }>()
  for (const p of pedidos) {
    const inicio = p.inicio ?? inicioPadrao
    mapa.set(idDoPar(p.chave, inicio), { chave: p.chave, inicio })
  }
  return [...mapa.values()].sort(
    (a, b) => comparar(a.chave, b.chave) || comparar(a.inicio, b.inicio),
  )
}

function comparar(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
