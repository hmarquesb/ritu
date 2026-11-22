import type { AgregadosDosRuns, BastidoresStore, SinaisDaSemana } from "@/core/bastidores/ports"
import type { Conexao } from "./mappers"

// Agregados dos runs e sinais por dia (spec 023). Só leitura, sem texto da pessoa.
export function createPgBastidores(sql: Conexao): BastidoresStore {
  return {
    async agregadosDosRuns(de, ate, opcoes): Promise<AgregadosDosRuns> {
      const [geral] = await sql<
        {
          runs: number
          duracao_p50_ms: number | null
          passos_medios: number | null
          julgados: number
          refeitas: number
          trocas: number
        }[]
      >`
        select count(*)::int as runs,
          percentile_cont(0.5) within group (order by latencia_ms)::float8 as duracao_p50_ms,
          avg(passos) filter (where caminho = 'acompanhante')::float8 as passos_medios,
          count(juiz_aprovado)::int as julgados,
          (count(*) filter (where juiz_aprovado is not null and juiz_tentativas = 2))::int as refeitas,
          coalesce(sum(trocas_de_modelo), 0)::int as trocas
        from runs
        where status = 'done' and dia between ${de} and ${ate}`

      const intencoes = await sql<{ intencao: string; total: number }[]>`
        select i.intencao, count(*)::int as total
        from runs r cross join lateral unnest(r.intencoes) as i(intencao)
        where r.status = 'done' and r.dia between ${de} and ${ate}
        group by i.intencao
        order by total desc, i.intencao`

      const tools = await sql<{ tool: string; total: number }[]>`
        select e.nome as tool, count(*)::int as total
        from run_etapas e join runs r on r.id = e.run_id
        where e.tipo = 'tool' and r.status = 'done' and r.dia between ${de} and ${ate}
          and not (e.nome = any(${opcoes.toolsFora}::text[]))
        group by e.nome
        order by total desc, e.nome
        limit ${opcoes.topTools}`

      return {
        runs: geral?.runs ?? 0,
        duracao_p50_ms: geral?.duracao_p50_ms ?? null,
        passos_medios: geral?.passos_medios ?? null,
        juiz: { julgados: geral?.julgados ?? 0, refeitas: geral?.refeitas ?? 0 },
        trocas_de_modelo: geral?.trocas ?? 0,
        intencoes,
        tools,
      }
    },

    async sinais(de, ate): Promise<SinaisDaSemana> {
      const linhas = await sql<{ sinal: string; total: number }[]>`
        select sinal, sum(total)::int as total from sinais_dia
        where dia between ${de} and ${ate}
        group by sinal`
      const total = (sinal: string): number => linhas.find((l) => l.sinal === sinal)?.total ?? 0
      return {
        feedback: { up: total("feedback_up"), down: total("feedback_down") },
        retornos: {
          ajudou: total("retorno_ajudou"),
          nao_ajudou: total("retorno_nao_ajudou"),
          nao_fez: total("retorno_nao_fez"),
        },
      }
    },

    async registrarSinaisDoDia(dia, fuso): Promise<number> {
      // Conta os cinco sinais do dia local e grava (zeros também). Refazer o registro troca o valor.
      const gravados = await sql<{ sinal: string }[]>`
        with contagens as (
          select 'feedback_up'::text as sinal, count(*) as total from feedback
            where voto = 'up' and (criado_em at time zone ${fuso})::date = ${dia}::date
          union all
          select 'feedback_down'::text, count(*) from feedback
            where voto = 'down' and (criado_em at time zone ${fuso})::date = ${dia}::date
          union all
          select 'retorno_ajudou'::text, count(*) from retornos
            where status = 'respondido' and resultado = 'ajudou'
              and (respondido_em at time zone ${fuso})::date = ${dia}::date
          union all
          select 'retorno_nao_ajudou'::text, count(*) from retornos
            where status = 'respondido' and resultado = 'nao_ajudou'
              and (respondido_em at time zone ${fuso})::date = ${dia}::date
          union all
          select 'retorno_nao_fez'::text, count(*) from retornos
            where status = 'respondido' and resultado = 'nao_fez'
              and (respondido_em at time zone ${fuso})::date = ${dia}::date
        )
        insert into sinais_dia (dia, sinal, total)
        select ${dia}::date, sinal, total::int from contagens
        on conflict (dia, sinal) do update set total = excluded.total
        returning sinal`
      return gravados.length
    },

    async apagarSinaisAntesDe(dia): Promise<number> {
      const apagadas = await sql`delete from sinais_dia where dia < ${dia}::date`
      return apagadas.count
    },
  }
}
