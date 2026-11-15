import type { Clock } from "@/core/clock"
import type { MessageRepository } from "@/core/messages/ports"
import { type Conexao, type MensagemRow, mensagemDe } from "./mappers"

export function createPgMessages(sql: Conexao, clock: Clock): MessageRepository {
  return {
    async gravar(contaId, m) {
      const [row] = await sql<[MensagemRow]>`
        insert into mensagens (conta_id, run_id, autor, texto, com_incomodo, dia, criado_em)
        values (${contaId}, ${m.run_id ?? null}, ${m.autor}, ${m.texto}, ${m.com_incomodo},
          ${m.dia}::date, ${clock.now()})
        returning id, conta_id, run_id, autor, texto, com_incomodo, dia::text as dia, criado_em`
      return mensagemDe(row)
    },

    async doDia(contaId, dia) {
      const linhas = await sql<MensagemRow[]>`
        select id, conta_id, run_id, autor, texto, com_incomodo, dia::text as dia, criado_em
        from mensagens
        where conta_id = ${contaId} and dia = ${dia}::date
        order by criado_em, id`
      return linhas.map(mensagemDe)
    },

    async marcarIncomodoDoRun(contaId, runId) {
      await sql`
        update mensagens set com_incomodo = true
        where conta_id = ${contaId} and run_id = ${runId}`
    },

    async apagarAntesDe(limite) {
      const apagadas = await sql`delete from mensagens where criado_em < ${limite}`
      return apagadas.count
    },

    async apagarComIncomodoAntesDoDia(dia) {
      const apagadas = await sql`
        delete from mensagens where com_incomodo and dia < ${dia}::date`
      return apagadas.count
    },
  }
}
