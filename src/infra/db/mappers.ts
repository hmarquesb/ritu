import type { Sql, TransactionSql } from "postgres"
import type { Conta, Perfil } from "@/core/accounts/types"
import type { Restricao } from "@/core/knowledge/vocab"
import {
  evitarSempreSchema,
  momentoSchema,
  naoComeSchema,
  prakritiSchema,
  sugestaoRegistradaSchema,
} from "@/core/memory-schemas"
import type { Mensagem } from "@/core/messages/ports"
import type { Retorno } from "@/core/outcomes/ports"
import type { ItemDaCasa } from "@/core/pantry/types"
import type { Padrao } from "@/core/patterns/ports"
import type { Preferencia } from "@/core/preferences/ports"
import type { Proposta } from "@/core/proposals/ports"
import type { NotaDeRotina, ResumoDeRotina } from "@/core/routine/ports"
import type { Run, RunEtapa } from "@/core/runs/ports"
import type { ItemDaLista } from "@/core/shortages/ports"

// Conversões entre linhas do driver e os tipos do core. O driver devolve timestamptz como Date,
// numeric como string e date como Date (por isso as consultas cast dates para text).

/** Conexão comum ou a de uma transação aberta. */
export type Conexao = Sql | TransactionSql

/** Valor aceito por sql.json (jsonb). */
export type JsonValor = Parameters<Sql["json"]>[0]

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

export type MensagemRow = {
  id: string
  conta_id: string
  run_id: string | null
  autor: Mensagem["autor"]
  texto: string
  com_incomodo: boolean
  dia: string
  criado_em: Date
}

export type RetornoRow = {
  id: string
  conta_id: string
  run_id: string
  sugestao: unknown
  status: Retorno["status"]
  resultado: Retorno["resultado"]
  origem: Retorno["origem"]
  criado_em: Date
  respondido_em: Date | null
}

export type NotaRow = {
  id: string
  conta_id: string
  texto: string
  ativa: boolean
  criado_em: Date
}

export type ResumoRow = {
  conta_id: string
  versao: number
  texto: string
  criado_em: Date
}

export type PadraoRow = {
  id: string
  conta_id: string
  tipo: Padrao["tipo"]
  chave: string
  frase: string
  ocorrencias: number
  status: Padrao["status"]
  criado_em: Date
  decidido_em: Date | null
}

export type RunRow = {
  id: string
  conta_id: string | null
  caminho: Run["caminho"]
  intencoes: string[]
  status: Run["status"]
  checkpoint: unknown
  pendencia: unknown
  momento: unknown
  com_incomodo: boolean
  clima_usado: unknown
  saida: unknown
  passos: number
  tokens_entrada: number
  tokens_saida: number
  latencia_ms: number
  modelos: unknown
  trocas_de_modelo: number
  prompt_versao: string | null
  juiz_tentativas: number
  juiz_aprovado: boolean | null
  trace_id: string | null
  dia: string
  fora_da_conversa: boolean
  criado_em: Date
  atualizado_em: Date
}

export type EtapaRow = {
  run_id: string
  ordem: number
  tipo: string
  nome: string
  resumo: string | null
  status: RunEtapa["status"]
  duracao_ms: number
  modelo: string | null
  tokens_entrada: number
  tokens_saida: number
  criado_em: Date
}

export type PropostaRow = {
  id: string
  run_id: string
  conta_id: string
  tool: string
  conteudo: unknown
  decisao: Proposta["decisao"]
  criado_em: Date
  decidida_em: Date | null
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

export function mensagemDe(row: MensagemRow): Mensagem {
  return {
    id: row.id,
    conta_id: row.conta_id,
    run_id: row.run_id,
    autor: row.autor,
    texto: row.texto,
    com_incomodo: row.com_incomodo,
    dia: row.dia,
    criado_em: row.criado_em.toISOString(),
  }
}

export function retornoDe(row: RetornoRow): Retorno {
  return {
    id: row.id,
    conta_id: row.conta_id,
    run_id: row.run_id,
    sugestao: sugestaoRegistradaSchema.parse(row.sugestao),
    status: row.status,
    resultado: row.resultado,
    origem: row.origem,
    criado_em: row.criado_em.toISOString(),
    respondido_em: isoOuNulo(row.respondido_em),
  }
}

export function notaDe(row: NotaRow): NotaDeRotina {
  return {
    id: row.id,
    conta_id: row.conta_id,
    texto: row.texto,
    ativa: row.ativa,
    criado_em: row.criado_em.toISOString(),
  }
}

export function resumoDe(row: ResumoRow): ResumoDeRotina {
  return {
    conta_id: row.conta_id,
    versao: row.versao,
    texto: row.texto,
    criado_em: row.criado_em.toISOString(),
  }
}

export function padraoDe(row: PadraoRow): Padrao {
  return {
    id: row.id,
    conta_id: row.conta_id,
    tipo: row.tipo,
    chave: row.chave,
    frase: row.frase,
    ocorrencias: row.ocorrencias,
    status: row.status,
    criado_em: row.criado_em.toISOString(),
    decidido_em: isoOuNulo(row.decidido_em),
  }
}

export function runDe(row: RunRow): Run {
  return {
    id: row.id,
    conta_id: row.conta_id,
    caminho: row.caminho,
    intencoes: row.intencoes,
    status: row.status,
    checkpoint: row.checkpoint,
    pendencia: row.pendencia,
    momento: row.momento === null ? null : momentoSchema.parse(row.momento),
    com_incomodo: row.com_incomodo,
    clima_usado: row.clima_usado,
    saida: row.saida,
    passos: row.passos,
    tokens_entrada: row.tokens_entrada,
    tokens_saida: row.tokens_saida,
    latencia_ms: row.latencia_ms,
    modelos: row.modelos,
    trocas_de_modelo: row.trocas_de_modelo,
    prompt_versao: row.prompt_versao,
    juiz_tentativas: row.juiz_tentativas,
    juiz_aprovado: row.juiz_aprovado,
    trace_id: row.trace_id,
    dia: row.dia,
    fora_da_conversa: row.fora_da_conversa,
    criado_em: row.criado_em.toISOString(),
    atualizado_em: row.atualizado_em.toISOString(),
  }
}

export function etapaDe(row: EtapaRow): RunEtapa {
  return {
    run_id: row.run_id,
    ordem: row.ordem,
    tipo: row.tipo,
    nome: row.nome,
    resumo: row.resumo,
    status: row.status,
    duracao_ms: row.duracao_ms,
    modelo: row.modelo,
    tokens_entrada: row.tokens_entrada,
    tokens_saida: row.tokens_saida,
    criado_em: row.criado_em.toISOString(),
  }
}

export function propostaDe(row: PropostaRow): Proposta {
  return {
    id: row.id,
    run_id: row.run_id,
    conta_id: row.conta_id,
    tool: row.tool,
    conteudo: row.conteudo,
    decisao: row.decisao,
    criado_em: row.criado_em.toISOString(),
    decidida_em: isoOuNulo(row.decidida_em),
  }
}

/** Usa a transação que já está aberta; fora dela, abre uma. */
export function numaTransacao<T>(sql: Conexao, fn: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return "savepoint" in sql ? fn(sql) : sql.begin(fn)
}
