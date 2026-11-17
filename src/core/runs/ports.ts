import type { Momento } from "@/core/memory-schemas"

export const CAMINHOS = [
  "acompanhante",
  "casa",
  "retorno",
  "evitar",
  "ajuda",
  "ofensa",
  "alerta",
  "fora",
  "sem_modelo",
] as const
export type Caminho = (typeof CAMINHOS)[number]

export const STATUS_RUN = [
  "running",
  "waiting_for_input",
  "waiting_for_approval",
  "done",
  "failed",
  "expired",
  "cancelled",
] as const
export type StatusRun = (typeof STATUS_RUN)[number]

export type Run = {
  id: string
  conta_id: string | null
  caminho: Caminho
  intencoes: string[]
  status: StatusRun
  checkpoint: unknown | null
  pendencia: unknown | null
  momento: Momento | null
  com_incomodo: boolean
  clima_usado: unknown | null
  saida: unknown | null
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
  /** Run fechado de um dia que a pessoa apagou: sai da conversa e fica só no rastro. */
  fora_da_conversa: boolean
  criado_em: string
  atualizado_em: string
}

export type RunMutavel = Omit<Run, "id" | "conta_id" | "criado_em" | "dia">

export type RunEtapa = {
  run_id: string
  ordem: number
  tipo: string
  nome: string
  resumo: string | null
  status: "ok" | "falhou" | "recusado"
  duracao_ms: number
  modelo: string | null
  tokens_entrada: number
  tokens_saida: number
  criado_em: string
}

export type TipoDeEtapa =
  | "interprete"
  | "llm"
  | "tool"
  | "validacao"
  | "pergunta"
  | "proposta"
  | "aprovacao"
  | "juiz"
  | "guardrail"
  | "troca_de_modelo"
  | "memoria"
  | "erro"

export type NovaEtapa = Omit<RunEtapa, "run_id" | "ordem" | "criado_em" | "tipo"> & {
  tipo: TipoDeEtapa
}

export interface RunRepository {
  /** Lança RunAbertoError quando a conta já tem run aberto. */
  criar(
    contaId: string,
    r: { caminho: Caminho; intencoes: string[]; dia: string; trace_id?: string },
  ): Promise<Run>
  buscar(contaId: string, runId: string): Promise<Run | undefined>
  aberto(contaId: string): Promise<Run | undefined>
  atualizar(contaId: string, runId: string, campos: Partial<RunMutavel>): Promise<void>
  /** Troca o status numa operação só (update … where status = de); devolve se trocou. */
  mudarStatusSe(contaId: string, runId: string, de: StatusRun, para: StatusRun): Promise<boolean>
  /** ordem = última + 1. */
  acrescentarEtapa(contaId: string, runId: string, etapa: NovaEtapa): Promise<RunEtapa>
  etapas(contaId: string, runId: string): Promise<RunEtapa[]>
  /** Só status done. */
  recentes(contaId: string, desde: Date, limite: number): Promise<Run[]>
  /** Sem contaId; contas com run done criado a partir de desde, cada uma uma vez. */
  contasComRunDesde(desde: Date): Promise<string[]>
  /** Runs da conta no dia (YYYY-MM-DD, fuso do run), sem os fora_da_conversa; mais antigo primeiro. */
  doDia(contaId: string, dia: string): Promise<Run[]>
  contarMensagensDoDia(contaId: string, dia: string): Promise<number>
  /** Runs fechados do dia: fora_da_conversa = true e saida, checkpoint, pendencia e clima_usado nulos. Devolve quantos. */
  tirarDaConversa(contaId: string, dia: string): Promise<number>
  /** Devolve o voto anterior; null sem voto antes ou run que não é da conta (e aí não grava). */
  votar(contaId: string, runId: string, voto: "up" | "down"): Promise<"up" | "down" | null>
  /** Voto da conta por run; runs sem voto ou de outra conta ficam de fora. */
  votos(contaId: string, runIds: string[]): Promise<Record<string, "up" | "down">>
  /** Sem contaId; devolve os ids. */
  expirarEmEsperaAntesDe(limite: Date): Promise<string[]>
}
