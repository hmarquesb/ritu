import { config } from "@config/index"
import type { Clock } from "@/core/clock"
import { RituError } from "@/core/errors"
import type { RoutineStore } from "@/core/routine/ports"
import { type Conexao, type NotaRow, notaDe, type ResumoRow, resumoDe } from "./mappers"

// Mesmo limite de nota que o fake: 200 caracteres por nota.
const TEXTO_NOTA_MAX = 200

export function createPgRoutine(sql: Conexao, clock: Clock): RoutineStore {
  return {
    async notasAtivas(contaId) {
      const linhas = await sql<NotaRow[]>`
        select id, conta_id, texto, ativa, criado_em
        from rotina_notas
        where conta_id = ${contaId} and ativa
        order by criado_em, id`
      return linhas.map(notaDe)
    },

    async anotar(contaId, texto) {
      if (texto.length > TEXTO_NOTA_MAX) {
        throw new RituError("texto_longo", "Nota longa demais para a rotina")
      }
      const [row] = await sql<[NotaRow]>`
        insert into rotina_notas (conta_id, texto, ativa, criado_em)
        values (${contaId}, ${texto}, true, ${clock.now()})
        returning id, conta_id, texto, ativa, criado_em`
      return notaDe(row)
    },

    async desativar(contaId, notaId) {
      await sql`
        update rotina_notas set ativa = false
        where id = ${notaId} and conta_id = ${contaId}`
    },

    async resumo(contaId) {
      const [row] = await sql<ResumoRow[]>`
        select conta_id, versao, texto, criado_em
        from rotina_resumos
        where conta_id = ${contaId}
        order by versao desc
        limit 1`
      return row ? resumoDe(row) : undefined
    },

    async gravarResumo(contaId, texto) {
      if (texto.length > config.memoria.resumoRotinaCaracteres) {
        throw new RituError("texto_longo", "Resumo longo demais para a rotina")
      }
      // A versão nova é a maior atual + 1; a chave primária (conta, versão) barra a corrida.
      const [row] = await sql<[ResumoRow]>`
        insert into rotina_resumos (conta_id, versao, texto, criado_em)
        select ${contaId}::uuid, coalesce(max(versao), 0) + 1, ${texto}::text, ${clock.now()}::timestamptz
        from rotina_resumos
        where conta_id = ${contaId}
        returning conta_id, versao, texto, criado_em`
      return resumoDe(row)
    },
  }
}
