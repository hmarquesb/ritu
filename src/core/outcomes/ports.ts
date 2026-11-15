import type { SugestaoRegistrada } from "@/core/memory-schemas"

export type { SugestaoRegistrada }

export type Resultado = "ajudou" | "nao_ajudou" | "nao_fez"

export type Retorno = {
  id: string
  conta_id: string
  run_id: string
  sugestao: SugestaoRegistrada
  status: "aguardando" | "respondido"
  resultado: Resultado | null
  origem: "toque" | "conversa" | null
  criado_em: string
  respondido_em: string | null
}

export interface OutcomeStore {
  criar(contaId: string, runId: string, sugestoes: SugestaoRegistrada[]): Promise<Retorno[]>
  /** Mais recente primeiro. */
  pendentes(contaId: string): Promise<Retorno[]>
  /** Já respondido: não muda. */
  responder(
    contaId: string,
    retornoId: string,
    resultado: Resultado,
    origem: "toque" | "conversa",
  ): Promise<Retorno | undefined>
  doRun(contaId: string, runId: string): Promise<Retorno[]>
  /** Sem contaId. */
  apagarAguardandoAntesDe(limite: Date): Promise<number>
}
