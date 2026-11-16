import type { TransactionSql } from "postgres"
import type { ItemTemporario, ProfileStore } from "@/core/accounts/ports"
import type { Perfil } from "@/core/accounts/types"
import type { Clock } from "@/core/clock"
import { RituError } from "@/core/errors"
import type { EvitarItem } from "@/core/knowledge/filtros"
import { normalizar } from "@/core/knowledge/identificar"
import { evitarSempreSchema, naoComeSchema, prakritiSchema } from "@/core/memory-schemas"
import { type Conexao, numaTransacao, type PerfilRow, perfilDe } from "./mappers"

type EvitarSempre = EvitarItem & { desde: string }

const arredonda2 = (n: number): number => Math.round(n * 100) / 100

const mesmoEvitar = (a: ItemTemporario, b: ItemTemporario): boolean =>
  a.tipo === b.tipo && normalizar(a.valor) === normalizar(b.valor)

function perfilVazio(contaId: string, agora: Date): Perfil {
  return {
    conta_id: contaId,
    prakriti: null,
    origem: null,
    evitar_sempre: [],
    restricoes: [],
    nao_come: [],
    cidade_nome: null,
    cidade_lat: null,
    cidade_lon: null,
    cidade_fuso: null,
    atualizado_em: agora.toISOString(),
  }
}

// Cria a linha do perfil com os campos vazios, se ainda não existir.
async function garantirPerfil(tx: TransactionSql, contaId: string, agora: Date): Promise<void> {
  await tx`
    insert into perfis (conta_id, evitar_sempre, restricoes, nao_come, atualizado_em)
    values (${contaId}, '[]'::jsonb, '{}'::text[], '[]'::jsonb, ${agora})
    on conflict (conta_id) do nothing`
}

// Trava a linha do perfil e devolve evitar_sempre dentro da transação.
async function lerEvitarSempreComTrava(
  tx: TransactionSql,
  contaId: string,
  agora: Date,
): Promise<EvitarSempre[]> {
  await garantirPerfil(tx, contaId, agora)
  const [row] = await tx<{ evitar_sempre: unknown }[]>`
    select evitar_sempre from perfis where conta_id = ${contaId} for update`
  return evitarSempreSchema.parse(row?.evitar_sempre ?? [])
}

async function gravarEvitarSempre(
  tx: TransactionSql,
  contaId: string,
  lista: EvitarSempre[],
  agora: Date,
): Promise<void> {
  await tx`
    update perfis
    set evitar_sempre = ${tx.json(evitarSempreSchema.parse(lista))}, atualizado_em = ${agora}
    where conta_id = ${contaId}`
}

export function createPgProfiles(sql: Conexao, clock: Clock): ProfileStore {
  return {
    async ler(contaId) {
      const [row] = await sql<PerfilRow[]>`
        select conta_id, prakriti, origem, evitar_sempre, restricoes, nao_come,
          cidade_nome, cidade_lat, cidade_lon, cidade_fuso, atualizado_em
        from perfis where conta_id = ${contaId}`
      return row ? perfilDe(row) : perfilVazio(contaId, clock.now())
    },

    async definirPrakriti(contaId, prakriti, origem) {
      const agora = clock.now()
      await sql`
        insert into perfis (conta_id, prakriti, origem, evitar_sempre, restricoes, nao_come, atualizado_em)
        values (
          ${contaId}, ${prakriti ? sql.json(prakritiSchema.parse(prakriti)) : null}, ${origem},
          '[]'::jsonb, '{}'::text[], '[]'::jsonb, ${agora}
        )
        on conflict (conta_id) do update
          set prakriti = excluded.prakriti, origem = excluded.origem,
            atualizado_em = excluded.atualizado_em`
    },

    async definirCidade(contaId, cidade) {
      const agora = clock.now()
      await sql`
        insert into perfis (conta_id, evitar_sempre, restricoes, nao_come,
          cidade_nome, cidade_lat, cidade_lon, cidade_fuso, atualizado_em)
        values (
          ${contaId}, '[]'::jsonb, '{}'::text[], '[]'::jsonb,
          ${cidade?.nome ?? null}, ${cidade ? arredonda2(cidade.lat) : null},
          ${cidade ? arredonda2(cidade.lon) : null}, ${cidade?.fuso ?? null}, ${agora}
        )
        on conflict (conta_id) do update
          set cidade_nome = excluded.cidade_nome, cidade_lat = excluded.cidade_lat,
            cidade_lon = excluded.cidade_lon, cidade_fuso = excluded.cidade_fuso,
            atualizado_em = excluded.atualizado_em`
    },

    async definirRestricoes(contaId, restricoes) {
      const agora = clock.now()
      await sql`
        insert into perfis (conta_id, evitar_sempre, restricoes, nao_come, atualizado_em)
        values (${contaId}, '[]'::jsonb, ${restricoes}::text[], '[]'::jsonb, ${agora})
        on conflict (conta_id) do update
          set restricoes = excluded.restricoes, atualizado_em = excluded.atualizado_em`
    },

    async definirNaoCome(contaId, itens) {
      const agora = clock.now()
      await sql`
        insert into perfis (conta_id, evitar_sempre, restricoes, nao_come, atualizado_em)
        values (${contaId}, '[]'::jsonb, '{}'::text[], ${sql.json(naoComeSchema.parse(itens))}, ${agora})
        on conflict (conta_id) do update
          set nao_come = excluded.nao_come, atualizado_em = excluded.atualizado_em`
    },

    async acrescentarEvitarSempre(contaId, itens) {
      const agora = clock.now()
      await numaTransacao(sql, async (tx) => {
        const lista = await lerEvitarSempreComTrava(tx, contaId, agora)
        for (const item of itens) {
          if (!lista.some((x) => mesmoEvitar(x, item))) {
            lista.push({ tipo: item.tipo, valor: item.valor, desde: agora.toISOString() })
          }
        }
        await gravarEvitarSempre(tx, contaId, lista, agora)
      })
    },

    async removerEvitarSempre(contaId, item, opts) {
      if (opts.confirmado !== true) {
        throw new RituError("confirmacao_necessaria", "Remover de evitar sempre exige confirmação")
      }
      const agora = clock.now()
      await numaTransacao(sql, async (tx) => {
        const lista = await lerEvitarSempreComTrava(tx, contaId, agora)
        const restante = lista.filter((x) => !mesmoEvitar(x, item))
        await gravarEvitarSempre(tx, contaId, restante, agora)
      })
    },

    async evitarTemporario(contaId, dia) {
      return sql<ItemTemporario[]>`
        select tipo, valor from evitar_temporario
        where conta_id = ${contaId} and dia = ${dia}::date
        order by tipo, valor`
    },

    async acrescentarEvitarTemporario(contaId, dia, itens) {
      await numaTransacao(sql, async (tx) => {
        const atuais = await tx<ItemTemporario[]>`
          select tipo, valor from evitar_temporario
          where conta_id = ${contaId} and dia = ${dia}::date`
        const novos: ItemTemporario[] = []
        for (const item of itens) {
          if (![...atuais, ...novos].some((x) => mesmoEvitar(x, item))) novos.push(item)
        }
        for (const item of novos) {
          await tx`
            insert into evitar_temporario (conta_id, tipo, valor, dia)
            values (${contaId}, ${item.tipo}, ${item.valor}, ${dia}::date)
            on conflict do nothing`
        }
      })
    },

    async apagarEvitarTemporarioAntesDe(dia) {
      const apagadas = await sql`delete from evitar_temporario where dia < ${dia}::date`
      return apagadas.count
    },
  }
}
