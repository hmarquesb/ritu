import type { Clock } from "@/core/clock"
import type { PatternStore } from "@/core/patterns/ports"
import { type Conexao, type PadraoRow, padraoDe } from "./mappers"

export function createPgPatterns(sql: Conexao, clock: Clock): PatternStore {
  return {
    async listar(contaId, status) {
      const linhas =
        status === undefined
          ? await sql<PadraoRow[]>`
              select id, conta_id, tipo, chave, frase, ocorrencias, status, criado_em, decidido_em
              from padroes where conta_id = ${contaId}
              order by criado_em, id`
          : await sql<PadraoRow[]>`
              select id, conta_id, tipo, chave, frase, ocorrencias, status, criado_em, decidido_em
              from padroes where conta_id = ${contaId} and status = ${status}
              order by criado_em, id`
      return linhas.map(padraoDe)
    },

    async propor(contaId, p) {
      // Já existir (qualquer status) não cria: o índice único por (conta, tipo, chave) cala o insert.
      const [row] = await sql<PadraoRow[]>`
        insert into padroes (conta_id, tipo, chave, frase, ocorrencias, status, criado_em)
        values (${contaId}, ${p.tipo}, ${p.chave}, ${p.frase}, ${p.ocorrencias}, 'candidato', ${clock.now()})
        on conflict (conta_id, tipo, chave) do nothing
        returning id, conta_id, tipo, chave, frase, ocorrencias, status, criado_em, decidido_em`
      return row ? padraoDe(row) : undefined
    },

    async decidir(contaId, padraoId, status) {
      await sql`
        update padroes set status = ${status}, decidido_em = ${clock.now()}
        where id = ${padraoId} and conta_id = ${contaId}`
    },

    async apagar(contaId, padraoId) {
      await sql`delete from padroes where id = ${padraoId} and conta_id = ${contaId}`
    },
  }
}
