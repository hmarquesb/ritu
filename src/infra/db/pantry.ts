import type { TransactionSql } from "postgres"
import type { Clock } from "@/core/clock"
import { normalizar } from "@/core/knowledge/identificar"
import type { PantryStore, ReferenciaDeItem } from "@/core/pantry/ports"
import type { ItemDaCasa } from "@/core/pantry/types"
import { type CasaRow, type Conexao, itemDaCasaDe, numaTransacao } from "./mappers"

export type OpcoesPantry = { alimentoExiste?: (id: string) => boolean }

type Ref = { alimento: string } | { livre: string }

// Um alimento_id que a base não conhece vira nome livre (o id é o nome).
function resolverRef(ref: ReferenciaDeItem, existe: (id: string) => boolean): Ref {
  if (ref.alimento_id !== undefined) {
    return existe(ref.alimento_id) ? { alimento: ref.alimento_id } : { livre: ref.alimento_id }
  }
  return { livre: ref.nome_livre ?? "" }
}

type Origem = ItemDaCasa["origem"]

async function registrarAlimento(
  tx: TransactionSql,
  contaId: string,
  alimentoId: string,
  origem: Origem,
  agora: Date,
): Promise<void> {
  await tx`
    insert into casa (conta_id, alimento_id, estado, sempre_tenho, confirmado_em, origem)
    values (${contaId}, ${alimentoId}, 'tem', false, ${agora}, ${origem})
    on conflict (conta_id, alimento_id) do update
      set estado = 'tem', confirmado_em = excluded.confirmado_em, origem = excluded.origem`
  await tx`delete from faltas where conta_id = ${contaId} and alimento_id = ${alimentoId}`
  await tx`
    delete from lista_ter_em_casa where conta_id = ${contaId} and alimento_id = ${alimentoId}`
}

async function registrarLivre(
  tx: TransactionSql,
  contaId: string,
  nome: string,
  origem: Origem,
  agora: Date,
): Promise<void> {
  const normalizado = normalizar(nome)
  await tx`
    insert into casa (conta_id, nome_livre, nome_normalizado, estado, sempre_tenho,
      confirmado_em, origem)
    values (${contaId}, ${nome}, ${normalizado}, 'tem', false, ${agora}, ${origem})
    on conflict (conta_id, nome_normalizado) do update
      set estado = 'tem', confirmado_em = excluded.confirmado_em, origem = excluded.origem`
  await tx`
    insert into alimentos_desconhecidos (nome, vezes) values (${normalizado}, 1)
    on conflict (nome) do update set vezes = alimentos_desconhecidos.vezes + 1`
}

export function createPgPantry(sql: Conexao, clock: Clock, opts: OpcoesPantry = {}): PantryStore {
  const existe = opts.alimentoExiste ?? (() => true)

  return {
    async listar(contaId) {
      const linhas = await sql<CasaRow[]>`
        select id, conta_id, alimento_id, nome_livre, nome_normalizado, estado,
          sempre_tenho, confirmado_em, origem
        from casa where conta_id = ${contaId}
        order by confirmado_em desc, id`
      return linhas.map(itemDaCasaDe)
    },

    async registrar(contaId, itens, origem) {
      const agora = clock.now()
      await numaTransacao(sql, async (tx) => {
        for (const ref of itens) {
          const r = resolverRef(ref, existe)
          if ("alimento" in r) await registrarAlimento(tx, contaId, r.alimento, origem, agora)
          else await registrarLivre(tx, contaId, r.livre, origem, agora)
        }
      })
    },

    async marcarAcabou(contaId, itens) {
      await numaTransacao(sql, async (tx) => {
        for (const ref of itens.map((i) => resolverRef(i, existe))) {
          if ("alimento" in ref) {
            await tx`
              update casa set estado = 'acabou'
              where conta_id = ${contaId} and alimento_id = ${ref.alimento}`
          } else {
            await tx`
              update casa set estado = 'acabou'
              where conta_id = ${contaId} and nome_normalizado = ${normalizar(ref.livre)}`
          }
        }
      })
    },

    async definirSempreTenho(contaId, itemId, valor) {
      await sql`
        update casa set sempre_tenho = ${valor}
        where id = ${itemId} and conta_id = ${contaId}`
    },

    async tirar(contaId, itemId) {
      await sql`delete from casa where id = ${itemId} and conta_id = ${contaId}`
    },

    async desconhecidos(limite) {
      return sql<{ nome: string; vezes: number }[]>`
        select nome, vezes from alimentos_desconhecidos
        order by vezes desc, nome
        limit ${limite}`
    },
  }
}
