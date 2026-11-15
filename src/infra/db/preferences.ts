import type { TransactionSql } from "postgres"
import type { Clock } from "@/core/clock"
import type { ItemTipo, PreferenceStore } from "@/core/preferences/ports"
import { type Conexao, numaTransacao, type PreferenciaRow, preferenciaDe } from "./mappers"

type Item = { tipo: ItemTipo; id: string }

// Cria a linha da preferência com os contadores zerados, se ainda não existir.
async function garantir(tx: TransactionSql, contaId: string, item: Item): Promise<void> {
  await tx`
    insert into preferencias (conta_id, item_tipo, item_id, ajudou, nao_ajudou, nao_fez,
      ultimos_resultados)
    values (${contaId}, ${item.tipo}, ${item.id}, 0, 0, 0, '{}'::text[])
    on conflict (conta_id, item_tipo, item_id) do nothing`
}

export function createPgPreferences(sql: Conexao, clock: Clock): PreferenceStore {
  return {
    async ler(contaId, itens) {
      const linhas = await sql<PreferenciaRow[]>`
        select conta_id, item_tipo, item_id, gosto, ajudou, nao_ajudou, nao_fez,
          ultimos_resultados, ultima_sugestao_em
        from preferencias where conta_id = ${contaId}
        order by item_tipo, item_id`
      const todas = linhas.map(preferenciaDe)
      if (itens === undefined) return todas
      return todas.filter((p) => itens.some((i) => i.tipo === p.item_tipo && i.id === p.item_id))
    },

    async definirGosto(contaId, item, gosto) {
      await numaTransacao(sql, async (tx) => {
        await garantir(tx, contaId, item)
        await tx`
          update preferencias set gosto = ${gosto}
          where conta_id = ${contaId} and item_tipo = ${item.tipo} and item_id = ${item.id}`
      })
    },

    async contarResultado(contaId, item, resultado) {
      const ehNaoFez = resultado === "nao_fez"
      await numaTransacao(sql, async (tx) => {
        await garantir(tx, contaId, item)
        // ajudou e nao_ajudou entram no início de ultimos_resultados (ficam só os 2 mais novos).
        await tx`
          update preferencias
          set ajudou = ajudou + ${resultado === "ajudou" ? 1 : 0},
            nao_ajudou = nao_ajudou + ${resultado === "nao_ajudou" ? 1 : 0},
            nao_fez = nao_fez + ${ehNaoFez ? 1 : 0},
            ultimos_resultados = case when ${ehNaoFez}
              then ultimos_resultados
              else (array[${resultado}]::text[] || ultimos_resultados)[1:2]
            end
          where conta_id = ${contaId} and item_tipo = ${item.tipo} and item_id = ${item.id}`
      })
    },

    async marcarSugerido(contaId, itens) {
      const agora = clock.now()
      await numaTransacao(sql, async (tx) => {
        for (const item of itens) {
          await garantir(tx, contaId, item)
          await tx`
            update preferencias set ultima_sugestao_em = ${agora}
            where conta_id = ${contaId} and item_tipo = ${item.tipo} and item_id = ${item.id}`
        }
      })
    },

    async contagem(contaId) {
      const [linha] = await sql<{ de_gosto: number; de_resultado: number }[]>`
        select count(*) filter (where gosto is not null)::int as de_gosto,
          count(*) filter (where ajudou + nao_ajudou + nao_fez > 0)::int as de_resultado
        from preferencias where conta_id = ${contaId}`
      return { de_gosto: linha?.de_gosto ?? 0, de_resultado: linha?.de_resultado ?? 0 }
    },

    async apagar(contaId, item) {
      await sql`
        delete from preferencias
        where conta_id = ${contaId} and item_tipo = ${item.tipo} and item_id = ${item.id}`
    },
  }
}
