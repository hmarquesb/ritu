import type { TransactionSql } from "postgres"
import type { AccountRepository } from "@/core/accounts/ports"
import type { Clock } from "@/core/clock"
import { type Conexao, type ContaRow, contaDe, numaTransacao } from "./mappers"

// Apaga as contas: antes, anonimiza os runs (sem conta, saída, checkpoint, pendência e clima)
// e tira o resumo das etapas. Depois, o delete cascateia as tabelas da conta.
async function apagarContas(tx: TransactionSql, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  await tx`
    update run_etapas set resumo = null
    where run_id in (select id from runs where conta_id = any(${ids}::uuid[]))`
  await tx`
    update runs
    set conta_id = null, saida = null, checkpoint = null, pendencia = null, clima_usado = null
    where conta_id = any(${ids}::uuid[])`
  const apagadas = await tx`delete from contas where id = any(${ids}::uuid[])`
  return apagadas.count
}

export function createPgAccounts(sql: Conexao, clock: Clock): AccountRepository {
  return {
    async criar(dados) {
      const [row] = await sql<[ContaRow]>`
        insert into contas (tipo, google_sub, email, expira_em, tester, criado_em)
        values (
          ${dados.tipo}, ${dados.google_sub ?? null}, ${dados.email ?? null},
          ${dados.expira_em ?? null}, false, ${clock.now()}
        )
        returning id, tipo, google_sub, email, expira_em, tester, aviso_aceito_em,
          evitar_passo, evitar_lembrete_em, dosha_adiado_em, criado_em`
      return contaDe(row)
    },

    async buscar(contaId) {
      const [row] = await sql<ContaRow[]>`
        select id, tipo, google_sub, email, expira_em, tester, aviso_aceito_em,
          evitar_passo, evitar_lembrete_em, dosha_adiado_em, criado_em
        from contas
        where id = ${contaId}
          and not (tipo = 'demo' and expira_em <= ${clock.now()})`
      return row ? contaDe(row) : undefined
    },

    async buscarPorGoogleSub(sub) {
      const [row] = await sql<ContaRow[]>`
        select id, tipo, google_sub, email, expira_em, tester, aviso_aceito_em,
          evitar_passo, evitar_lembrete_em, dosha_adiado_em, criado_em
        from contas
        where google_sub = ${sub}`
      return row ? contaDe(row) : undefined
    },

    async marcar(contaId, campos) {
      if (Object.keys(campos).length === 0) return
      await sql`update contas set ${sql(campos)} where id = ${contaId}`
    },

    async apagar(contaId) {
      await numaTransacao(sql, (tx) => apagarContas(tx, [contaId]))
    },

    async apagarDemosVencidas() {
      return numaTransacao(sql, async (tx) => {
        const vencidas = await tx<{ id: string }[]>`
          select id from contas
          where tipo = 'demo' and expira_em <= ${clock.now()}`
        return apagarContas(
          tx,
          vencidas.map((v) => v.id),
        )
      })
    },
  }
}
