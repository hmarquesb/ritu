import type { Clock } from "@/core/clock"
import type { ProposalStore, Proposta } from "@/core/proposals/ports"
import {
  type Conexao,
  type JsonValor,
  numaTransacao,
  type PropostaRow,
  propostaDe,
} from "./mappers"

export function createPgProposals(sql: Conexao, clock: Clock): ProposalStore {
  return {
    async criar(contaId, runId, propostas) {
      const agora = clock.now()
      return numaTransacao(sql, async (tx) => {
        const criadas: Proposta[] = []
        for (const p of propostas) {
          const [row] = await tx<[PropostaRow]>`
            insert into propostas (run_id, conta_id, tool, conteudo, decisao, criado_em)
            values (${runId}, ${contaId}, ${p.tool}, ${tx.json(p.conteudo as JsonValor)},
              'pendente', ${agora})
            returning id, run_id, conta_id, tool, conteudo, decisao, criado_em, decidida_em`
          criadas.push(propostaDe(row))
        }
        return criadas
      })
    },

    async doRun(contaId, runId) {
      const linhas = await sql<PropostaRow[]>`
        select id, run_id, conta_id, tool, conteudo, decisao, criado_em, decidida_em
        from propostas where conta_id = ${contaId} and run_id = ${runId}
        order by criado_em, id`
      return linhas.map(propostaDe)
    },

    async decidir(contaId, propostaId, decisao) {
      return numaTransacao(sql, async (tx) => {
        // Só muda se a proposta ainda está pendente.
        await tx`
          update propostas set decisao = ${decisao}, decidida_em = ${clock.now()}
          where id = ${propostaId} and conta_id = ${contaId} and decisao = 'pendente'`
        const [row] = await tx<PropostaRow[]>`
          select id, run_id, conta_id, tool, conteudo, decisao, criado_em, decidida_em
          from propostas where id = ${propostaId} and conta_id = ${contaId}`
        return row ? propostaDe(row) : undefined
      })
    },

    async recusadas(contaId, tool) {
      const linhas = await sql<PropostaRow[]>`
        select id, run_id, conta_id, tool, conteudo, decisao, criado_em, decidida_em
        from propostas
        where conta_id = ${contaId} and tool = ${tool} and decisao = 'recusada'
        order by criado_em, id`
      return linhas.map(propostaDe)
    },

    async expirarDosRuns(runIds) {
      if (runIds.length === 0) return 0
      const expiradas = await sql`
        update propostas set decisao = 'expirada'
        where decisao = 'pendente' and run_id = any(${runIds}::uuid[])`
      return expiradas.count
    },
  }
}
