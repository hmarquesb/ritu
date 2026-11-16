import type { Clock } from "@/core/clock"
import { sugestaoRegistradaSchema } from "@/core/memory-schemas"
import type { OutcomeStore, Resultado, Retorno, SugestaoRegistrada } from "@/core/outcomes/ports"
import { type Conexao, numaTransacao, type RetornoRow, retornoDe } from "./mappers"

export function createPgOutcomes(sql: Conexao, clock: Clock): OutcomeStore {
  return {
    async criar(contaId, runId, sugestoes) {
      // Valida tudo antes de gravar: uma sugestão inválida não deixa nada no banco.
      const validas: SugestaoRegistrada[] = sugestoes.map((s) => sugestaoRegistradaSchema.parse(s))
      const agora = clock.now()
      return numaTransacao(sql, async (tx) => {
        const criados: Retorno[] = []
        for (const sugestao of validas) {
          const [row] = await tx<[RetornoRow]>`
            insert into retornos (conta_id, run_id, sugestao, status, criado_em)
            values (${contaId}, ${runId}, ${tx.json(sugestao)}, 'aguardando', ${agora})
            returning id, conta_id, run_id, sugestao, status, resultado, origem,
              criado_em, respondido_em`
          criados.push(retornoDe(row))
        }
        return criados
      })
    },

    async pendentes(contaId) {
      const linhas = await sql<RetornoRow[]>`
        select id, conta_id, run_id, sugestao, status, resultado, origem, criado_em, respondido_em
        from retornos
        where conta_id = ${contaId} and status = 'aguardando'
        order by criado_em desc, id`
      return linhas.map(retornoDe)
    },

    async respondidosDesde(contaId, desde) {
      const linhas = await sql<RetornoRow[]>`
        select id, conta_id, run_id, sugestao, status, resultado, origem, criado_em, respondido_em
        from retornos
        where conta_id = ${contaId} and status = 'respondido' and respondido_em >= ${desde}`
      return linhas.map(retornoDe)
    },

    async responder(contaId, retornoId, resultado: Resultado, origem) {
      return numaTransacao(sql, async (tx) => {
        // Só o aguardando muda; um já respondido fica como está.
        const mudadas = await tx`
          update retornos
          set status = 'respondido', resultado = ${resultado}, origem = ${origem},
            respondido_em = ${clock.now()}
          where id = ${retornoId} and conta_id = ${contaId} and status = 'aguardando'
          returning id`
        const [row] = await tx<RetornoRow[]>`
          select id, conta_id, run_id, sugestao, status, resultado, origem, criado_em, respondido_em
          from retornos where id = ${retornoId} and conta_id = ${contaId}`
        return row ? { retorno: retornoDe(row), mudou: mudadas.length > 0 } : undefined
      })
    },

    async atualizarSugestao(contaId, retornoId, sugestao) {
      // Valida antes de gravar; a conta e o status entram no filtro, como em responder.
      const valida = sugestaoRegistradaSchema.parse(sugestao)
      const [row] = await sql<RetornoRow[]>`
        update retornos
        set sugestao = ${sql.json(valida)}
        where id = ${retornoId} and conta_id = ${contaId} and status = 'aguardando'
        returning id, conta_id, run_id, sugestao, status, resultado, origem, criado_em, respondido_em`
      return row ? retornoDe(row) : undefined
    },

    async doRun(contaId, runId) {
      const linhas = await sql<RetornoRow[]>`
        select id, conta_id, run_id, sugestao, status, resultado, origem, criado_em, respondido_em
        from retornos where conta_id = ${contaId} and run_id = ${runId}`
      return linhas.map(retornoDe)
    },

    async apagarAguardandoAntesDe(limite) {
      const apagadas = await sql`
        delete from retornos where status = 'aguardando' and criado_em < ${limite}`
      return apagadas.count
    },
  }
}
