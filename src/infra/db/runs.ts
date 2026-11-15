import type { TransactionSql } from "postgres"
import type { Clock } from "@/core/clock"
import { RituError } from "@/core/errors"
import { momentoSchema } from "@/core/memory-schemas"
import { RunAbertoError } from "@/core/runs/errors"
import type { NovaEtapa, RunMutavel, RunRepository } from "@/core/runs/ports"
import {
  type Conexao,
  type EtapaRow,
  etapaDe,
  type JsonValor,
  numaTransacao,
  type RunRow,
  runDe,
} from "./mappers"

// Colunas em jsonb: o driver grava com sql.json; null vai como SQL NULL.
const CAMPOS_JSON = new Set([
  "checkpoint",
  "pendencia",
  "momento",
  "clima_usado",
  "saida",
  "modelos",
])
// OID de text[] no Postgres.
const OID_TEXT_ARRAY = 1009
const INDICE_RUN_ABERTO = "runs_uma_aberta_por_conta"

// Só a violação do índice parcial de run aberto vira RunAbertoError; o resto passa.
function ehRunAberto(erro: unknown): boolean {
  return (
    typeof erro === "object" &&
    erro !== null &&
    "code" in erro &&
    erro.code === "23505" &&
    "constraint_name" in erro &&
    erro.constraint_name === INDICE_RUN_ABERTO
  )
}

async function garantirRunDaConta(tx: TransactionSql, contaId: string, runId: string) {
  const [dono] = await tx`select 1 from runs where id = ${runId} and conta_id = ${contaId}`
  if (!dono) throw new RituError("run_nao_encontrado", "Run não encontrado")
}

// Monta o SET do update: jsonb vai com sql.json, text[] com o OID, e o momento passa pelo schema.
function paraAtualizacao(
  sql: Conexao,
  campos: Partial<RunMutavel>,
  agora: Date,
): Record<string, unknown> {
  const valores: Record<string, unknown> = {}
  for (const [coluna, valor] of Object.entries(campos)) {
    if (valor === undefined) continue
    if (valor === null) valores[coluna] = null
    else if (coluna === "momento") valores[coluna] = sql.json(momentoSchema.parse(valor))
    else if (CAMPOS_JSON.has(coluna)) valores[coluna] = sql.json(valor as JsonValor)
    else if (coluna === "intencoes") valores[coluna] = sql.array(valor as string[], OID_TEXT_ARRAY)
    else valores[coluna] = valor
  }
  return { ...valores, atualizado_em: agora }
}

export function createPgRuns(sql: Conexao, clock: Clock): RunRepository {
  return {
    async criar(contaId, r) {
      const agora = clock.now()
      try {
        const [row] = await sql<[RunRow]>`
          insert into runs (conta_id, caminho, intencoes, status, checkpoint, pendencia, momento,
            com_incomodo, clima_usado, saida, passos, tokens_entrada, tokens_saida, latencia_ms,
            modelos, trocas_de_modelo, prompt_versao, juiz_tentativas, juiz_aprovado, trace_id,
            dia, criado_em, atualizado_em)
          values (${contaId}, ${r.caminho}, ${r.intencoes}::text[], 'running', null, null, null,
            false, null, null, 0, 0, 0, 0, ${sql.json({})}, 0, null, 0, null, ${r.trace_id ?? null},
            ${r.dia}::date, ${agora}, ${agora})
          returning id, conta_id, caminho, intencoes, status, checkpoint, pendencia, momento,
            com_incomodo, clima_usado, saida, passos, tokens_entrada, tokens_saida, latencia_ms,
            modelos, trocas_de_modelo, prompt_versao, juiz_tentativas, juiz_aprovado, trace_id,
            dia::text as dia, criado_em, atualizado_em`
        return runDe(row)
      } catch (erro) {
        if (ehRunAberto(erro)) throw new RunAbertoError()
        throw erro
      }
    },

    async buscar(contaId, runId) {
      const [row] = await sql<RunRow[]>`
        select id, conta_id, caminho, intencoes, status, checkpoint, pendencia, momento,
          com_incomodo, clima_usado, saida, passos, tokens_entrada, tokens_saida, latencia_ms,
          modelos, trocas_de_modelo, prompt_versao, juiz_tentativas, juiz_aprovado, trace_id,
          dia::text as dia, criado_em, atualizado_em
        from runs where id = ${runId} and conta_id = ${contaId}`
      return row ? runDe(row) : undefined
    },

    async aberto(contaId) {
      const [row] = await sql<RunRow[]>`
        select id, conta_id, caminho, intencoes, status, checkpoint, pendencia, momento,
          com_incomodo, clima_usado, saida, passos, tokens_entrada, tokens_saida, latencia_ms,
          modelos, trocas_de_modelo, prompt_versao, juiz_tentativas, juiz_aprovado, trace_id,
          dia::text as dia, criado_em, atualizado_em
        from runs
        where conta_id = ${contaId}
          and status in ('running', 'waiting_for_input', 'waiting_for_approval')`
      return row ? runDe(row) : undefined
    },

    async atualizar(contaId, runId, campos) {
      const valores = paraAtualizacao(sql, campos, clock.now())
      await sql`update runs set ${sql(valores)} where id = ${runId} and conta_id = ${contaId}`
    },

    async mudarStatusSe(contaId, runId, de, para) {
      const linhas = await sql`
        update runs set status = ${para}, atualizado_em = ${clock.now()}
        where id = ${runId} and conta_id = ${contaId} and status = ${de}
        returning id`
      return linhas.length > 0
    },

    async acrescentarEtapa(contaId, runId, etapa: NovaEtapa) {
      return numaTransacao(sql, async (tx) => {
        await garantirRunDaConta(tx, contaId, runId)
        const [row] = await tx<[EtapaRow]>`
          insert into run_etapas (run_id, ordem, tipo, nome, resumo, status, duracao_ms, modelo,
            tokens_entrada, tokens_saida, criado_em)
          select ${runId}::uuid, coalesce(max(ordem), 0) + 1, ${etapa.tipo}::text,
            ${etapa.nome}::text, ${etapa.resumo}::text, ${etapa.status}::text,
            ${etapa.duracao_ms}::integer, ${etapa.modelo}::text, ${etapa.tokens_entrada}::integer,
            ${etapa.tokens_saida}::integer, ${clock.now()}::timestamptz
          from run_etapas where run_id = ${runId}::uuid
          returning run_id, ordem, tipo, nome, resumo, status, duracao_ms, modelo,
            tokens_entrada, tokens_saida, criado_em`
        return etapaDe(row)
      })
    },

    async etapas(contaId, runId) {
      const linhas = await sql<EtapaRow[]>`
        select e.run_id, e.ordem, e.tipo, e.nome, e.resumo, e.status, e.duracao_ms, e.modelo,
          e.tokens_entrada, e.tokens_saida, e.criado_em
        from run_etapas e join runs r on r.id = e.run_id
        where e.run_id = ${runId} and r.conta_id = ${contaId}
        order by e.ordem`
      return linhas.map(etapaDe)
    },

    async recentes(contaId, desde, limite) {
      const linhas = await sql<RunRow[]>`
        select id, conta_id, caminho, intencoes, status, checkpoint, pendencia, momento,
          com_incomodo, clima_usado, saida, passos, tokens_entrada, tokens_saida, latencia_ms,
          modelos, trocas_de_modelo, prompt_versao, juiz_tentativas, juiz_aprovado, trace_id,
          dia::text as dia, criado_em, atualizado_em
        from runs
        where conta_id = ${contaId} and status = 'done' and criado_em >= ${desde}
        order by criado_em desc, id
        limit ${limite}`
      return linhas.map(runDe)
    },

    async contarMensagensDoDia(contaId, dia) {
      const [linha] = await sql<{ total: number }[]>`
        select count(*)::int as total from mensagens
        where conta_id = ${contaId} and dia = ${dia}::date and autor = 'pessoa'`
      return linha?.total ?? 0
    },

    async votar(contaId, runId, voto) {
      // O select só acha o run da conta: run de outra conta não gera linha nenhuma.
      await sql`
        insert into feedback (run_id, conta_id, voto, criado_em)
        select id, conta_id, ${voto}::text, ${clock.now()}::timestamptz
        from runs where id = ${runId} and conta_id = ${contaId}
        on conflict (run_id) do update set voto = excluded.voto`
    },

    async expirarEmEsperaAntesDe(limite) {
      const linhas = await sql<{ id: string }[]>`
        update runs set status = 'expired'
        where status in ('waiting_for_input', 'waiting_for_approval') and atualizado_em < ${limite}
        returning id`
      return linhas.map((linha) => linha.id)
    },
  }
}
