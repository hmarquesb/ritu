import type { Sql, TransactionSql } from "postgres"
import type { Conta, Perfil } from "@/core/accounts/types"
import type { Restricao } from "@/core/knowledge/vocab"
import { evitarSempreSchema, naoComeSchema, prakritiSchema } from "@/core/memory-schemas"
import type { ItemDaCasa } from "@/core/pantry/types"
import type { Preferencia } from "@/core/preferences/ports"
import type { ItemDaLista } from "@/core/shortages/ports"

// Conversões entre linhas do driver e os tipos do core. O driver devolve timestamptz como Date,
// numeric como string e date como Date (por isso as consultas cast dates para text).

/** Conexão comum ou a de uma transação aberta. */
export type Conexao = Sql | TransactionSql

export type ContaRow = {
  id: string
  tipo: Conta["tipo"]
  google_sub: string | null
  email: string | null
  expira_em: Date | null
  tester: boolean
  aviso_aceito_em: Date | null
  evitar_passo: Conta["evitar_passo"]
  evitar_lembrete_em: Date | null
  dosha_adiado_em: Date | null
  criado_em: Date
}

export type PerfilRow = {
  conta_id: string
  prakriti: unknown
  origem: Perfil["origem"]
  evitar_sempre: unknown
  restricoes: string[]
  nao_come: unknown
  cidade_nome: string | null
  cidade_lat: string | null
  cidade_lon: string | null
  cidade_fuso: string | null
  atualizado_em: Date
}

export type CasaRow = {
  id: string
  conta_id: string
  alimento_id: string | null
  nome_livre: string | null
  nome_normalizado: string | null
  estado: ItemDaCasa["estado"]
  sempre_tenho: boolean
  confirmado_em: Date
  origem: ItemDaCasa["origem"]
}

export type ListaRow = {
  conta_id: string
  alimento_id: string
  motivo: ItemDaLista["motivo"]
  detalhe: string
  criado_em: Date
}

export type PreferenciaRow = {
  conta_id: string
  item_tipo: Preferencia["item_tipo"]
  item_id: string
  gosto: Preferencia["gosto"]
  ajudou: number
  nao_ajudou: number
  nao_fez: number
  ultimos_resultados: string[]
  ultima_sugestao_em: Date | null
}

const isoOuNulo = (data: Date | null): string | null => (data ? data.toISOString() : null)

const numeroOuNulo = (valor: string | null): number | null =>
  valor === null ? null : Number(valor)

export function contaDe(row: ContaRow): Conta {
  return {
    id: row.id,
    tipo: row.tipo,
    google_sub: row.google_sub,
    email: row.email,
    expira_em: isoOuNulo(row.expira_em),
    tester: row.tester,
    aviso_aceito_em: isoOuNulo(row.aviso_aceito_em),
    evitar_passo: row.evitar_passo,
    evitar_lembrete_em: isoOuNulo(row.evitar_lembrete_em),
    dosha_adiado_em: isoOuNulo(row.dosha_adiado_em),
    criado_em: row.criado_em.toISOString(),
  }
}

export function perfilDe(row: PerfilRow): Perfil {
  return {
    conta_id: row.conta_id,
    prakriti: prakritiSchema.nullable().parse(row.prakriti),
    origem: row.origem,
    evitar_sempre: evitarSempreSchema.parse(row.evitar_sempre),
    restricoes: row.restricoes as Restricao[],
    nao_come: naoComeSchema.parse(row.nao_come),
    cidade_nome: row.cidade_nome,
    cidade_lat: numeroOuNulo(row.cidade_lat),
    cidade_lon: numeroOuNulo(row.cidade_lon),
    cidade_fuso: row.cidade_fuso,
    atualizado_em: row.atualizado_em.toISOString(),
  }
}

export function itemDaCasaDe(row: CasaRow): ItemDaCasa {
  return {
    id: row.id,
    conta_id: row.conta_id,
    alimento_id: row.alimento_id,
    nome_livre: row.nome_livre,
    nome_normalizado: row.nome_normalizado,
    estado: row.estado,
    sempre_tenho: row.sempre_tenho,
    confirmado_em: row.confirmado_em.toISOString(),
    origem: row.origem,
  }
}

export function itemDaListaDe(row: ListaRow): ItemDaLista {
  return {
    conta_id: row.conta_id,
    alimento_id: row.alimento_id,
    motivo: row.motivo,
    detalhe: row.detalhe,
    criado_em: row.criado_em.toISOString(),
  }
}

export function preferenciaDe(row: PreferenciaRow): Preferencia {
  return {
    conta_id: row.conta_id,
    item_tipo: row.item_tipo,
    item_id: row.item_id,
    gosto: row.gosto,
    ajudou: row.ajudou,
    nao_ajudou: row.nao_ajudou,
    nao_fez: row.nao_fez,
    ultimos_resultados: row.ultimos_resultados as Preferencia["ultimos_resultados"],
    ultima_sugestao_em: isoOuNulo(row.ultima_sugestao_em),
  }
}

/** Usa a transação que já está aberta; fora dela, abre uma. */
export function numaTransacao<T>(sql: Conexao, fn: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return "savepoint" in sql ? fn(sql) : sql.begin(fn)
}
