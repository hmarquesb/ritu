import type { Clock } from "@/core/clock"
import type { ShortageStore } from "@/core/shortages/ports"
import { type Conexao, itemDaListaDe, type ListaRow, numaTransacao } from "./mappers"

export function createPgShortages(sql: Conexao, clock: Clock): ShortageStore {
  return {
    async registrar(contaId, faltas, dia) {
      await numaTransacao(sql, async (tx) => {
        for (const falta of faltas) {
          await tx`
            insert into faltas (conta_id, alimento_id, dia, origem, run_id)
            values (${contaId}, ${falta.alimento_id}, ${dia}::date, ${falta.origem}, ${falta.run_id ?? null})
            on conflict (conta_id, alimento_id, dia) do nothing`
        }
      })
    },

    async diasComFalta(contaId, desdeDia) {
      return sql<{ alimento_id: string; dias: number; ultimo_dia: string }[]>`
        select alimento_id, count(*)::int as dias, max(dia)::text as ultimo_dia
        from faltas
        where conta_id = ${contaId} and dia >= ${desdeDia}::date
        group by alimento_id
        order by alimento_id`
    },

    async apagarDoAlimento(contaId, alimentoId) {
      await sql`delete from faltas where conta_id = ${contaId} and alimento_id = ${alimentoId}`
    },

    async lista(contaId) {
      const linhas = await sql<ListaRow[]>`
        select conta_id, alimento_id, motivo, detalhe, criado_em
        from lista_ter_em_casa where conta_id = ${contaId}
        order by criado_em desc, alimento_id`
      return linhas.map(itemDaListaDe)
    },

    async porNaLista(contaId, item) {
      await sql`
        insert into lista_ter_em_casa (conta_id, alimento_id, motivo, detalhe, criado_em)
        values (${contaId}, ${item.alimento_id}, ${item.motivo}, ${item.detalhe}, ${clock.now()})
        on conflict (conta_id, alimento_id) do update
          set motivo = excluded.motivo, detalhe = excluded.detalhe, criado_em = excluded.criado_em`
    },

    async tirarDaLista(contaId, alimentoId) {
      await sql`
        delete from lista_ter_em_casa
        where conta_id = ${contaId} and alimento_id = ${alimentoId}`
    },

    async apagarFaltasAntesDe(dia) {
      const apagadas = await sql`delete from faltas where dia < ${dia}::date`
      return apagadas.count
    },
  }
}
